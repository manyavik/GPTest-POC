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
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to call grading API");
    }

    return await response.json();
  } catch (error) {
    console.error("Grading Service Error:", error);
    throw error;
  }
}
