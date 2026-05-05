import type { Assessment, Rubric, RubricCriterion, RubricMode } from '../types';

/** Firestore assessments created before `rubric.mode` existed. */
export function getRubricMode(rubric: Rubric | undefined): RubricMode {
  if (!rubric) return 'custom';
  if (rubric.mode) return rubric.mode;
  return rubric.criteria?.length ? 'custom' : 'default';
}

export function getRubricTotalPoints(rubric: Rubric | undefined): number {
  if (!rubric) return 0;
  if (typeof rubric.totalPoints === 'number' && rubric.totalPoints > 0) return rubric.totalPoints;
  const crit = rubric.criteria ?? [];
  return crit.reduce((s, c) => s + (c.maxPoints || 0), 0);
}

export function formatRubricSummary(assessment: Assessment): string {
  const mode = getRubricMode(assessment.rubric);
  const total = getRubricTotalPoints(assessment.rubric);
  if (mode === 'default') {
    return `Holistic grading · up to ${total} pts`;
  }
  const n = assessment.rubric.criteria?.length ?? 0;
  return `Custom rubric · ${n} criteria · ${total} pts total`;
}

export type CustomCriterionDraft = {
  maxPoints: number;
  name: string;
  description: string;
};

export function allocatedPoints(criteria: CustomCriterionDraft[]): number {
  return criteria.reduce((s, c) => s + (Number(c.maxPoints) > 0 ? Number(c.maxPoints) : 0), 0);
}

export function customCriteriaToRubric(
  totalPoints: number,
  rows: CustomCriterionDraft[]
): RubricCriterion[] {
  return rows
    .filter((r) => r.name.trim() && r.maxPoints > 0)
    .map((r) => ({
      name: r.name.trim(),
      description: r.description.trim(),
      maxPoints: r.maxPoints,
    }));
}
