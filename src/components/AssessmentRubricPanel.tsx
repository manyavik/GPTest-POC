import { CheckCircle, Sparkles, ListChecks } from 'lucide-react';
import type { Assessment } from '../types';
import { getRubricMode, getRubricTotalPoints } from '../utils/rubric';

type Props = {
  assessment: Assessment;
  heading?: string;
};

export function AssessmentRubricPanel({ assessment, heading = 'Grading rubric' }: Props) {
  const mode = getRubricMode(assessment.rubric);
  const total = getRubricTotalPoints(assessment.rubric);
  const criteria = assessment.rubric.criteria ?? [];

  return (
    <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-indigo-600" />
        {heading}
      </h3>

      {mode === 'default' ? (
        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
            <Sparkles className="w-4 h-4 shrink-0" />
            Holistic (default)
          </div>
          <p className="text-xs text-indigo-900/80 leading-relaxed">
            AI assigns one score from <strong>0</strong> to <strong>{total}</strong> using overall judgment against the
            prompt—no fixed checklist of categories.
          </p>
        </div>
      ) : criteria.length === 0 ? (
        <p className="text-sm text-gray-500">No rubric criteria on file for this assessment.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
            <ListChecks className="w-3.5 h-3.5" />
            Custom · {total} pts total
          </div>
          {criteria.map((c, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex justify-between items-start mb-1 gap-2">
                <span className="font-bold text-sm text-gray-900">{c.name}</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
                  {c.maxPoints} pts
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{c.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
