import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Sparkles, User, ArrowLeft, Save, Edit3, AlertTriangle } from 'lucide-react';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { AI_GRADING_PLACEHOLDER } from '../constants/submission';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Submission, Assessment } from '../types';
import { motion } from 'motion/react';

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

  const handleSaveRevision = async () => {
    if (!submissionId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'submissions', submissionId), {
        score: editedScore,
        feedback: editedFeedback,
        status: 'revised'
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
                      Waiting for automatic grading (OpenAI). This usually finishes within a minute while the student
                      keeps this tab open after submitting.
                    </p>
                    <p className="text-sm text-amber-800/80 mt-2">
                      If this stays here for several minutes, grading may have failed (API key, network). The student
                      should try submitting again or ask you to grade manually.
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
              </div>
            )}
          </section>
        </div>

        {/* Assessment Context Sidebar */}
        <div className="space-y-6">
          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-600" />
              Rubric Reference
            </h3>
            <div className="space-y-4">
              {assessment.rubric.criteria.map((c, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-gray-900">{c.name}</span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Max {c.maxPoints}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{c.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
