import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Grading
  app.post("/api/grade", async (req, res) => {
    const { assessment, submissionContent } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
    }

    try {
      const rubricStr = assessment.rubric.criteria
        .map((c: any) => `- ${c.name} (Max ${c.maxPoints} pts): ${c.description}`)
        .join("\n");

      const prompt = `
        You are an expert academic grader. Grade the following student submission based on the provided rubric and assessment prompt.
        
        Assessment Title: ${assessment.title}
        Assessment Prompt: ${assessment.prompt}
        
        Rubric:
        ${rubricStr}
        
        Student Submission:
        ${submissionContent}
        
        Provide a score (total points earned) and detailed constructive feedback for the student.
        Return the response in JSON format with keys: "score" (number), "feedback" (string), and "justification" (string).
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("OpenAI Grading Error:", error);
      res.status(500).json({ error: error.message || "Failed to grade submission" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
