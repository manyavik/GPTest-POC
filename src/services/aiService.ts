import { Rubric, Assessment } from "../types";

export async function gradeSubmission(assessment: Assessment, submissionContent: string) {
  try {
    const response = await fetch("/api/grade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assessment, submissionContent }),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) detail = errorData.error;
      } catch {
        // non-JSON body
      }
      throw new Error(detail);
    }

    return await response.json();
  } catch (error) {
    console.error("Grading Service Error:", error);
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        "Could not reach the grading server. Use npm run dev (port 3000) so /api/grade is available."
      );
    }
    throw error;
  }
}
