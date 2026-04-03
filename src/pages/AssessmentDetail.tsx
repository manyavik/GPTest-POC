import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FileText, Send, CheckCircle, Clock, ArrowLeft, Users, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, updateDoc, DocumentReference } from 'firebase/firestore';
import { db, FIRESTORE_DATABASE_ID } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Assessment, Submission } from '../types';
import { gradeSubmission } from '../services/aiService';
import { AI_GRADING_PLACEHOLDER } from '../constants/submission';
import { motion, AnimatePresence } from 'motion/react';

export default function AssessmentDetail() {
  const { assessmentId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) return;
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      navigate('/dashboard');
      return;
    }

    setLoadError(null);

    const assessmentRef = doc(db, 'assessments', assessmentId);
    const unsubscribeAssessment = onSnapshot(
      assessmentRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setAssessment({ id: docSnap.id, ...docSnap.data() } as Assessment);
        } else {
          navigate('/dashboard');
        }
      },
      (err) => {
        console.error('Assessment snapshot error:', err);
        setLoadError(`[Assessment doc] ${err.message}`);
        setLoading(false);
      }
    );

    const endLoading = (err?: Error) => {
      if (err) {
        console.error('Submissions snapshot error:', err);
        setLoadError(`[Submissions query] ${err.message}`);
      }
      setLoading(false);
    };

    if (user.role === 'teacher') {
      // Single-field query so older submissions without teacherId still appear; filter below.
      const q = query(collection(db, 'submissions'), where('assessmentId', '==', assessmentId));
      const unsubscribeSubmissions = onSnapshot(
        q,
        (snapshot) => {
          const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
          const mine = rows.filter((s) => !s.teacherId || s.teacherId === user.uid);
          setSubmissions(mine);
          setLoading(false);
        },
        (err) => endLoading(err)
      );
      return () => {
        unsubscribeAssessment();
        unsubscribeSubmissions();
      };
    }

    if (user.role === 'student') {
      const q = query(
        collection(db, 'submissions'),
        where('assessmentId', '==', assessmentId),
        where('studentId', '==', user.uid)
      );
      const unsubscribeMySub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            setMySubmission({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Submission);
          }
          setLoading(false);
        },
        (err) => endLoading(err)
      );
      return () => {
        unsubscribeAssessment();
        unsubscribeMySub();
      };
    }

    setLoading(false);
    return () => unsubscribeAssessment();
  }, [assessmentId, user, navigate, authLoading]);

  useEffect(() => {
    if (user?.role !== 'teacher' || submissions.length === 0) return;
    const ids = [...new Set(submissions.map((s) => s.studentId))];
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const d = snap.data() as { displayName?: string; email?: string };
              const label = (d.displayName && d.displayName.trim()) || d.email || uid;
              return [uid, label] as const;
            }
          } catch {
            /* ignore */
          }
          return [uid, `Student (${uid.slice(0, 6)}…)`] as const;
        })
      );
      if (!cancelled) setStudentNames(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [submissions, user?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assessment || !content.trim()) return;

    setIsSubmitting(true);
    let submissionRef: DocumentReference | null = null;
    try {
      let teacherId = assessment.teacherId;
      if (!teacherId && assessment.classId) {
        const clsSnap = await getDoc(doc(db, 'classes', assessment.classId));
        teacherId = (clsSnap.data()?.teacherId as string) || '';
      }
      if (!teacherId) {
        alert('Could not resolve this class’s teacher. Your teacher may need to re-save the assessment.');
        setIsSubmitting(false);
        return;
      }
      // 1. Create initial submission
      const submissionData = {
        assessmentId: assessment.id,
        teacherId,
        studentId: user.uid,
        content,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        score: 0,
        feedback: AI_GRADING_PLACEHOLDER
      };

      submissionRef = await addDoc(collection(db, 'submissions'), submissionData);

      // 2. Trigger AI Grading
      const aiResult = await gradeSubmission(assessment, content);

      // 3. Update submission with AI result
      await updateDoc(submissionRef, {
        score: aiResult.score,
        feedback: aiResult.feedback,
        status: 'graded',
        aiRawResponse: JSON.stringify(aiResult)
      });

      setContent('');
    } catch (error) {
      console.error("Submission Error:", error);
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please try again.";
      alert(`Failed to submit: ${message}`);
      if (submissionRef) {
        try {
          await updateDoc(submissionRef, {
            status: 'graded',
            score: 0,
            feedback: `Automatic grading did not complete (${message}). Your teacher can review and score this submission manually.`,
          });
        } catch (e) {
          console.error("Could not write submission error state:", e);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center h-64">Loading assessment...</div>;
  }
  if (loadError) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-6 bg-red-50 border border-red-100 rounded-2xl text-red-800">
        <p className="font-bold mb-2">Could not load this assessment</p>
        <p className="text-sm mb-4">{loadError}</p>
        <p className="text-xs text-red-600 leading-relaxed">
          This app uses the named Firestore database <code className="bg-red-100 px-1 rounded">{FIRESTORE_DATABASE_ID}</code>.
          Rules must be published to <strong>that</strong> database (Firebase console → Firestore → database dropdown → pick this ID, then Rules), not only to &quot;(default)&quot;.
          If you use the CLI: <code className="bg-red-100 px-1 rounded">firebase deploy --only firestore:rules</code> with this repo&apos;s <code className="bg-red-100 px-1 rounded">firebase.json</code> (it targets the named DB).
        </p>
        <p className="text-xs text-red-600 mt-2">
          If the error mentions an index, use the link in the browser devtools console to create it.
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mt-4 text-sm font-bold text-indigo-600 hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }
  if (!assessment) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-indigo-600">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{assessment.title}</h1>
          <p className="text-gray-500 mt-1">Assessment Details & Submissions</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Prompt Section */}
          <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Prompt & Instructions
            </h2>
            <div className="prose prose-indigo max-w-none text-gray-700 whitespace-pre-wrap">
              {assessment.prompt}
            </div>
          </section>

          {/* Student View: Submission Form or Status */}
          {user?.role === 'student' && (
            <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                Your Submission
              </h2>

              {mySubmission ? (
                <div className="space-y-6">
                  <div className={`p-6 rounded-2xl border flex items-center justify-between ${
                    mySubmission.status === 'graded' ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'
                  }`}>
                    <div className="flex items-center gap-4">
                      {mySubmission.status === 'graded' ? (
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      ) : (
                        <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
                      )}
                      <div>
                        <h3 className={`font-bold ${mySubmission.status === 'graded' ? 'text-green-800' : 'text-amber-800'}`}>
                          {mySubmission.status === 'graded' ? 'Graded' : 'Pending AI Feedback'}
                        </h3>
                        <p className="text-sm opacity-75">Submitted on {new Date(mySubmission.submittedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {mySubmission.status === 'graded' && (
                      <div className="text-right">
                        <span className="text-3xl font-black text-green-700">{mySubmission.score}</span>
                        <span className="text-sm text-green-600 block">Total Points</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-2">Submitted Content</h4>
                    <p className="text-gray-700 whitespace-pre-wrap italic">{mySubmission.content}</p>
                  </div>

                  {mySubmission.status === 'graded' && (
                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                      <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> AI Feedback
                      </h4>
                      <p className="text-indigo-800 leading-relaxed">{mySubmission.feedback}</p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <textarea
                    required
                    rows={10}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type your response here..."
                    className="w-full px-6 py-4 rounded-2xl border border-gray-200 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-lg"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
                      isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                  >
                    {isSubmitting ? (
                      <>Grading in progress...</>
                    ) : (
                      <>Submit for AI Grading <Send className="w-5 h-5" /></>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-400">
                    Your submission will be instantly graded by Gemini AI based on the rubric.
                  </p>
                </form>
              )}
            </section>
          )}

          {/* Teacher View: Submissions List */}
          {user?.role === 'teacher' && (
            <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Student Submissions ({submissions.length})
              </h2>

              {submissions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No submissions yet.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {submissions.map((sub) => (
                    <Link
                      key={sub.id}
                      to={`/submission/${sub.id}`}
                      className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          sub.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {sub.status === 'graded' ? sub.score : '?'}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">
                            {studentNames[sub.studentId] ?? `Student (${sub.studentId.slice(0, 6)}…)`}
                          </h4>
                          <p className="text-xs text-gray-500">Submitted {new Date(sub.submittedAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                        Review <ChevronRight className="w-4 h-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Sidebar: Rubric */}
        <div className="space-y-6">
          <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-600" />
              Grading Rubric
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

          <section className="bg-indigo-600 text-white rounded-3xl p-6 shadow-xl shadow-indigo-100">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Grading
            </h3>
            <p className="text-sm text-indigo-100 leading-relaxed">
              GPTest uses advanced LLMs to provide instant feedback. Teachers can review and override any AI-generated score.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
