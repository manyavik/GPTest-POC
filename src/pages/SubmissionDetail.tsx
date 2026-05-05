import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, User, ArrowLeft, Save, Edit3, AlertTriangle } from 'lucide-react';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { AI_GRADING_PLACEHOLDER } from '../constants/submission';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Submission, Assessment } from '../types';
import { motion } from 'motion/react';
import { AssessmentRubricPanel } from '../components/AssessmentRubricPanel';

export default function SubmissionDetail() {
  const { submissionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit State (for teachers)
  const [isEditing, setIsEditing] = useState(false);
  const [editedScore, setEditedScore] = useState(0);
  const [editedFeedback, setEditedFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [studentLabel, setStudentLabel] = useState<string | null>(null);
  const gradingRecoverySent = useRef(false);

  useEffect(() => {
    gradingRecoverySent.current = false;
  }, [submissionId]);

  useEffect(() => {
    if (!submissionId) return;

    const subRef = doc(db, 'submissions', submissionId);
    const unsubscribeSub = onSnapshot(subRef, async (docSnap) => {
      if (docSnap.exists()) {
        const subData = { id: docSnap.id, ...docSnap.data() } as Submission;
        setSubmission(subData);
        setEditedScore(subData.score);
        setEditedFeedback(subData.feedback);

        const userSnap = await getDoc(doc(db, 'users', subData.studentId));
        if (userSnap.exists()) {
          const u = userSnap.data() as { displayName?: string; email?: string };
          setStudentLabel((u.displayName && u.displayName.trim()) || u.email || null);
        } else {
          setStudentLabel(null);
        }

        // Fetch assessment for context
        const assRef = doc(db, 'assessments', subData.assessmentId);
        const assSnap = await getDoc(assRef);
        if (assSnap.exists()) {
          setAssessment({ id: assSnap.id, ...assSnap.data() } as Assessment);
        }
        setLoading(false);
      } else {
        navigate('/dashboard');
      }
    });

    return unsubscribeSub;
  }, [submissionId, navigate]);

  useEffect(() => {
    if (!submissionId || !submission || !user) return;
    const stuck =
      submission.status === 'pending' &&
      submission.feedback.trim() === AI_GRADING_PLACEHOLDER.trim();
    if (!stuck || gradingRecoverySent.current) return;
    gradingRecoverySent.current = true;

    void (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          gradingRecoverySent.current = false;
          return;
        }
        const res = await fetch('/api/submissions/complete-grade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ submissionId }),
        });
        if (!res.ok) {
          gradingRecoverySent.current = false;
        }
      } catch {
        gradingRecoverySent.current = false;
      }
    })();
  }, [submissionId, submission, user]);

  const handleSaveRevision = async () => {
    if (!submissionId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'submissions', submissionId), {
        score: editedScore,
        feedback: editedFeedback,
        status: 'revised',
        teacherRevisedAt: new Date().toISOString(),
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Revision Error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to save revision.";
      alert(`Failed to save revision: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading submission...</div>;
  if (!submission || !assessment) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-indigo-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Submission Review</h1>
            <p className="text-gray-500 mt-1">
              {studentLabel ?? `Student (${submission.studentId.slice(0, 6)}…)`} · {assessment.title}
            </p>
          </div>
        </div>

        {user?.role === 'teacher' && !isEditing && submission.status !== 'pending' && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Edit3 className="w-5 h-5" />
            Revise AI Grade
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Student Content */}
          <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Student Response
            </h2>
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 text-lg text-gray-800 leading-relaxed whitespace-pre-wrap italic">
              "{submission.content}"
            </div>
          </section>

          {/* Grading Section */}
          <section className={`rounded-3xl border p-8 shadow-sm transition-all ${
            isEditing ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100'
          }`}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                {submission.status === 'revised' ? 'Teacher Revised Feedback' : 'AI Generated Feedback'}
              </h2>
              {submission.status === 'revised' && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  Revised by Teacher
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-6">
                {submission.aiFeedback != null && submission.aiFeedback !== '' && (
                  <div className="p-5 rounded-2xl border border-indigo-100 bg-white/80 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                      Original AI output (stored for research — unchanged on save)
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="text-center shrink-0">
                        <span className="text-3xl font-black text-indigo-500">{submission.aiScore ?? '—'}</span>
                        <span className="text-[10px] text-indigo-400 block font-bold uppercase mt-0.5">AI score</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-l border-indigo-100 pl-4">
                        {submission.aiFeedback}
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Total Score</label>
                  <input
                    type="number"
                    value={editedScore}
                    onChange={(e) => setEditedScore(Number(e.target.value))}
                    className="w-32 px-4 py-3 rounded-xl border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500 text-2xl font-black text-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Feedback</label>
                  <textarea
                    rows={6}
                    value={editedFeedback}
                    onChange={(e) => setEditedFeedback(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-gray-500 hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRevision}
                    disabled={isSaving}
                    className="flex-1 py-3 px-6 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {isSaving ? 'Saving...' : 'Save Revision'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {submission.status === 'pending' &&
                submission.feedback.trim() === AI_GRADING_PLACEHOLDER.trim() ? (
                  <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-amber-900 font-medium">
                      Automatic grading is running on the server. This usually finishes within a minute—you do not need
                      the student to keep a tab open.
                    </p>
                    <p className="text-sm text-amber-800/80 mt-2">
                      If this message remains for several minutes, OpenAI or Firebase Admin may be misconfigured on the
                      server, or the job failed—check the dev server logs. Refreshing this page retries grading for
                      stuck submissions.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-6 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="text-center">
                      <span className="text-5xl font-black text-indigo-600">{submission.score}</span>
                      <span className="text-xs text-indigo-400 block font-bold uppercase mt-1">Score</span>
                    </div>
                    <div className="h-12 w-px bg-indigo-200" />
                    <p className="text-indigo-800 leading-relaxed font-medium whitespace-pre-wrap">
                      {submission.feedback}
                    </p>
                  </div>
                )}

                {user?.role === 'student' && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      This score was generated by AI. Your teacher may review and adjust this score during the grading period.
                    </p>
                  </div>
                )}

                {user?.role === 'teacher' &&
                  submission.status === 'revised' &&
                  submission.aiFeedback != null &&
                  submission.aiFeedback !== '' && (
                    <details className="group rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                      <summary className="cursor-pointer text-sm font-bold text-gray-600 list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
                        <span className="text-indigo-500 group-open:rotate-90 transition-transform">›</span>
                        Original AI grading (archived for comparison)
                      </summary>
                      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-4 text-sm text-gray-700">
                        <div className="shrink-0 text-center sm:text-left">
                          <span className="text-2xl font-black text-gray-500">{submission.aiScore ?? '—'}</span>
                          <span className="block text-[10px] font-bold uppercase text-gray-400 mt-0.5">AI score</span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap flex-1">{submission.aiFeedback}</p>
                      </div>
                    </details>
                  )}
              </div>
            )}
          </section>
        </div>

        {/* Assessment Context Sidebar */}
        <div className="space-y-6">
          <AssessmentRubricPanel assessment={assessment} heading="Rubric reference" />
        </div>
      </div>
    </div>
  );
}
