import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { readFileSync } from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

dotenv.config();

/** Must match src/constants/submission.ts */
const AI_GRADING_PLACEHOLDER = "AI is grading your submission...";

const firebaseConfig = JSON.parse(
  readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")
) as { firestoreDatabaseId: string; projectId: string };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

function getFirebaseAdmin(): { db: Firestore; auth: ReturnType<typeof getAuth> } {
  if (getApps().length === 0) {
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (saJson) {
      initializeApp({ credential: cert(JSON.parse(saJson)) });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId: firebaseConfig.projectId,
      });
    }
  }
  const app = getApps()[0]!;
  return {
    db: getFirestore(app, firebaseConfig.firestoreDatabaseId),
    auth: getAuth(app),
  };
}

async function assertCanGradeSubmission(uid: string, sub: Record<string, unknown>, db: Firestore) {
  if (sub.studentId === uid) return;
  if (sub.teacherId === uid) return;
  const assSnap = await db.collection("assessments").doc(sub.assessmentId as string).get();
  if (!assSnap.exists) throw new Error("Forbidden");
  const classId = assSnap.data()!.classId as string;
  const classSnap = await db.collection("classes").doc(classId).get();
  if (!classSnap.exists) throw new Error("Forbidden");
  if (classSnap.data()!.teacherId === uid) return;
  throw new Error("Forbidden");
}

async function gradeWithOpenAI(assessment: Record<string, unknown>, submissionContent: string) {
  const rubric = assessment.rubric as
    | {
        mode?: string;
        totalPoints?: number;
        criteria?: { name: string; maxPoints: number; description: string }[];
      }
    | undefined;

  const criteria = rubric?.criteria ?? [];
  const sumCriteria = criteria.reduce((s, c) => s + (Number(c.maxPoints) || 0), 0);
  const declaredTotal =
    typeof rubric?.totalPoints === "number" && rubric.totalPoints > 0 ? rubric.totalPoints : sumCriteria;
  const totalPoints = declaredTotal > 0 ? declaredTotal : 100;

  const legacyCustom = !rubric?.mode && criteria.length > 0;
  const explicitDefault = rubric?.mode === "default";
  const useHolistic = explicitDefault || (!legacyCustom && criteria.length === 0);

  let gradingBlock: string;
  if (useHolistic) {
    gradingBlock = `Grading approach: **holistic judgment only** (no separate rubric categories).

Maximum score: **${totalPoints}** points.
Use your professional judgment based on the assessment title and prompt and typical academic standards.
Return a single whole-number score from 0 through ${totalPoints} (inclusive) and explain your reasoning in the feedback.`;
  } else {
    const rubricStr = criteria
      .map((c) => `- **${c.maxPoints} pts** — *${c.name}*: ${c.description}`)
      .join("\n");
    gradingBlock = `Maximum total score: **${totalPoints}** points.

Grade using this rubric. Award points per criterion (partial credit allowed). The student's **score** must be the sum of points earned across all criteria, from 0 to ${totalPoints}.

Rubric:
${rubricStr}`;
  }

  const prompt = `
You are an expert academic grader.

Assessment Title: ${assessment.title}
Assessment Prompt: ${assessment.prompt}

${gradingBlock}

Student Submission:
${submissionContent}

Provide the total score (number) and detailed constructive feedback.
Return JSON with keys: "score" (number), "feedback" (string), and "justification" (string).
`.trim();

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || "{}") as {
    score: number;
    feedback: string;
    justification?: string;
  };
}

async function processSubmissionGrade(submissionId: string) {
  const { db } = getFirebaseAdmin();
  const ref = db.collection("submissions").doc(submissionId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const sub = snap.data()!;
  if (sub.status !== "pending") return;
  if (String(sub.feedback ?? "").trim() !== AI_GRADING_PLACEHOLDER) return;

  const assSnap = await db.collection("assessments").doc(sub.assessmentId as string).get();
  if (!assSnap.exists) {
    await ref.update({
      status: "graded",
      score: 0,
      feedback:
        "Automatic grading did not complete (assessment missing). Your teacher can review and score this submission manually.",
    });
    return;
  }

  const assessment = { id: assSnap.id, ...assSnap.data() } as Record<string, unknown>;

  try {
    const aiResult = await gradeWithOpenAI(assessment, sub.content as string);
    await ref.update({
      score: aiResult.score,
      feedback: aiResult.feedback,
      status: "graded",
      aiRawResponse: JSON.stringify(aiResult),
      aiScore: aiResult.score,
      aiFeedback: aiResult.feedback,
    });
  } catch (error: unknown) {
    console.error("OpenAI Grading Error (async):", error);
    const message = error instanceof Error ? error.message : "Failed to grade submission";
    await ref.update({
      status: "graded",
      score: 0,
      feedback: `Automatic grading did not complete (${message}). Your teacher can review and score this submission manually.`,
    });
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.post("/api/grade", async (req, res) => {
    const { assessment, submissionContent } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
    }

    try {
      const result = await gradeWithOpenAI(assessment, submissionContent);
      res.json(result);
    } catch (error: unknown) {
      console.error("OpenAI Grading Error:", error);
      const msg = error instanceof Error ? error.message : "Failed to grade submission";
      res.status(500).json({ error: msg });
    }
  });

  /** Starts OpenAI grading on the server so it finishes if the student closes the tab. */
  app.post("/api/submissions/complete-grade", async (req, res) => {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return res.status(401).json({ error: "Missing Authorization bearer token." });
    }

    const { submissionId } = req.body as { submissionId?: string };
    if (!submissionId || typeof submissionId !== "string") {
      return res.status(400).json({ error: "submissionId is required." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "OPENAI_API_KEY is not configured on the server." });
    }

    try {
      const { db, auth } = getFirebaseAdmin();
      const decoded = await auth.verifyIdToken(idToken);
      const ref = db.collection("submissions").doc(submissionId);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Submission not found." });
      }
      const sub = snap.data()!;
      await assertCanGradeSubmission(decoded.uid, sub, db);

      if (sub.status !== "pending" || String(sub.feedback ?? "").trim() !== AI_GRADING_PLACEHOLDER) {
        return res.json({ status: "noop", message: "Already graded or not awaiting AI." });
      }

      void processSubmissionGrade(submissionId).catch((err) => console.error("Background grading failed:", err));

      return res.status(202).json({ status: "grading" });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "Forbidden") {
        return res.status(403).json({ error: "Forbidden." });
      }
      console.error("complete-grade error:", e);
      const err = e as { code?: string; message?: string };
      const credsHint =
        err?.message?.includes("credential") ||
        err?.message?.includes("Could not load the default credentials") ||
        err?.code === "app/no-app";
      const msg = credsHint
        ? "Firebase Admin is not configured. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file, or FIREBASE_SERVICE_ACCOUNT_JSON."
        : err?.message || "Failed to start grading.";
      return res.status(503).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
  });
}

startServer();
