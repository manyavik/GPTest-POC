import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Calendar,
  FileText,
  ChevronRight,
  Users,
  ArrowLeft,
  Trash2,
  Sparkles,
  ListChecks,
  Info,
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Class, Assessment } from '../types';
import {
  allocatedPoints,
  customCriteriaToRubric,
  formatRubricSummary,
  type CustomCriterionDraft,
} from '../utils/rubric';
import { motion, AnimatePresence } from 'motion/react';

export default function ClassDetail() {
  const { classId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cls, setCls] = useState<Class | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAssessment, setShowCreateAssessment] = useState(false);

  // New Assessment State
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [rubricMode, setRubricMode] = useState<'default' | 'custom'>('default');
  const [rubricTotalPoints, setRubricTotalPoints] = useState(10);
  const [customCriteria, setCustomCriteria] = useState<CustomCriterionDraft[]>([]);

  const resetAssessmentForm = () => {
    setNewTitle('');
    setNewPrompt('');
    setNewDueDate('');
    setRubricMode('default');
    setRubricTotalPoints(10);
    setCustomCriteria([]);
  };

  const addCustomRow = () => {
    setCustomCriteria((rows) => [...rows, { maxPoints: 1, name: '', description: '' }]);
  };

  const removeCustomRow = (index: number) => {
    setCustomCriteria((rows) => rows.filter((_, i) => i !== index));
  };

  const updateCustomRow = (index: number, patch: Partial<CustomCriterionDraft>) => {
    setCustomCriteria((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const customAllocated = allocatedPoints(customCriteria);
  const customRowsValid =
    customCriteria.length > 0 &&
    customCriteria.every((r) => r.name.trim().length > 0 && r.maxPoints > 0);
  const customBalanced = customAllocated === rubricTotalPoints && rubricTotalPoints > 0;

  useEffect(() => {
    if (!classId) return;

    const classRef = doc(db, 'classes', classId);
    const unsubscribeClass = onSnapshot(classRef, (docSnap) => {
      if (docSnap.exists()) {
        setCls({ id: docSnap.id, ...docSnap.data() } as Class);
      } else {
        navigate('/dashboard');
      }
    });

    const q = query(collection(db, 'assessments'), where('classId', '==', classId));
    const unsubscribeAssessments = onSnapshot(q, (snapshot) => {
      setAssessments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment)));
      setLoading(false);
    });

    return () => {
      unsubscribeClass();
      unsubscribeAssessments();
    };
  }, [classId, navigate]);

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !newTitle.trim() || !user) return;

    if (rubricMode === 'default' && rubricTotalPoints < 1) return;

    if (rubricMode === 'custom') {
      if (!customBalanced || !customRowsValid) return;
    }

    const rubric =
      rubricMode === 'default'
        ? {
            mode: 'default' as const,
            totalPoints: rubricTotalPoints,
            criteria: [] as { name: string; description: string; maxPoints: number }[],
          }
        : {
            mode: 'custom' as const,
            totalPoints: rubricTotalPoints,
            criteria: customCriteriaToRubric(rubricTotalPoints, customCriteria),
          };

    const normalizedDueDate = newDueDate
      ? new Date(`${newDueDate}T23:59:59`).toISOString()
      : '';

    const newAssessment = {
      classId,
      teacherId: user.uid,
      title: newTitle.trim(),
      prompt: newPrompt,
      dueDate: normalizedDueDate,
      rubric,
    };

    try {
      await addDoc(collection(db, 'assessments'), newAssessment);
      resetAssessmentForm();
      setShowCreateAssessment(false);
    } catch (error) {
      console.error('Create assessment failed:', error);
      const message = error instanceof Error ? error.message : 'Could not create assessment.';
      alert(`Create assessment failed: ${message}`);
    }
  };

  const handleDeleteAssessment = async (id: string) => {
    if (window.confirm('Delete this assessment?')) {
      await deleteDoc(doc(db, 'assessments', id));
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading class details...</div>;
  if (!cls) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-indigo-600">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{cls.name}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {cls.studentIds.length} Students</span>
            <span className="flex items-center gap-1 font-mono bg-gray-100 px-2 py-0.5 rounded">Invite: {cls.inviteCode}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Assessments</h2>
        {user?.role === 'teacher' && (
          <button
            onClick={() => setShowCreateAssessment(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            New Assessment
          </button>
        )}
      </div>

      {assessments.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">No assessments yet</h3>
          <p className="text-gray-500">Create your first assessment to start grading.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{assessment.title}</h3>
                  <div className="flex flex-col gap-1 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Due: {assessment.dueDate ? new Date(assessment.dueDate).toLocaleDateString() : 'No deadline'}
                    </span>
                    <span className="text-xs text-indigo-600/90 font-medium">{formatRubricSummary(assessment)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {user?.role === 'teacher' && (
                  <button 
                    onClick={() => handleDeleteAssessment(assessment.id)}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <Link
                  to={`/assessment/${assessment.id}`}
                  className="flex items-center gap-1 px-4 py-2 bg-gray-50 text-gray-900 rounded-lg font-bold hover:bg-indigo-600 hover:text-white transition-all"
                >
                  View <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assessment Modal */}
      <AnimatePresence>
        {showCreateAssessment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-bold mb-2">Create New Assessment</h2>
              <p className="text-sm text-gray-500 mb-6">
                Set the prompt, then choose how AI should score work: holistic (default) or your own point-by-point rubric.
              </p>
              <form onSubmit={handleCreateAssessment} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Proof by induction problem set"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Prompt / Instructions</label>
                  <textarea
                    required
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe the assessment requirements..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">Grading rubric</label>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    All AI scores are expressed in points. Students see feedback tied to the option you pick below.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRubricMode('default')}
                      className={`text-left p-4 rounded-2xl border-2 transition-all ${
                        rubricMode === 'default'
                          ? 'border-indigo-500 bg-indigo-50/80 shadow-sm'
                          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        Default (holistic)
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        AI judges overall quality against your prompt only—no categories. You set the point maximum.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRubricMode('custom')}
                      className={`text-left p-4 rounded-2xl border-2 transition-all ${
                        rubricMode === 'custom'
                          ? 'border-indigo-500 bg-indigo-50/80 shadow-sm'
                          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                        <ListChecks className="w-4 h-4 text-indigo-600" />
                        Custom rubric
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        You define point buckets (e.g. 3 pts “base case”) and what each means for this class.
                      </p>
                    </button>
                  </div>
                </div>

                {rubricMode === 'default' ? (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 space-y-3">
                    <div className="flex gap-2 text-sm text-indigo-900">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        The model assigns one score from <strong>0</strong> up to your maximum, using its own judgment—no
                        fixed checklist. Use the prompt above to spell out what “excellent” looks like.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Total points for this assignment</label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        required
                        value={rubricTotalPoints || ''}
                        onChange={(e) => {
                          if (e.target.value === '') {
                            setRubricTotalPoints(0);
                            return;
                          }
                          const next = Number(e.target.value);
                          if (Number.isNaN(next)) return;
                          setRubricTotalPoints(Math.max(1, Math.floor(next)));
                        }}
                        className="w-32 px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/40 p-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Total points (must match rubric sum)</label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          required
                          value={rubricTotalPoints || ''}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              setRubricTotalPoints(0);
                              return;
                            }
                            const next = Number(e.target.value);
                            if (Number.isNaN(next)) return;
                            setRubricTotalPoints(Math.max(1, Math.floor(next)));
                          }}
                          className="w-32 px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                        />
                      </div>
                      <div
                        className={`text-sm font-bold px-3 py-2 rounded-xl ${
                          customBalanced && customRowsValid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        Allocated: {customAllocated} / {rubricTotalPoints} pts
                        {customBalanced && customRowsValid ? ' ✓' : ''}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed flex gap-2">
                      <Info className="w-4 h-4 shrink-0 text-gray-400" />
                      Add one row per rubric item. Enter how many points it is worth, a short name, and what you expect
                      (so the AI can match your preferences). Point values across all rows must add up exactly to the
                      total.
                    </p>

                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                      {customCriteria.map((row, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3"
                        >
                          <div className="flex flex-wrap gap-3 items-start">
                            <div className="w-24">
                              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                                Points
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={rubricTotalPoints}
                                value={row.maxPoints || ''}
                                onChange={(e) =>
                                  updateCustomRow(index, { maxPoints: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-center font-bold"
                              />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                                Criterion name
                              </label>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => updateCustomRow(index, { name: e.target.value })}
                                placeholder="e.g. Base case"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCustomRow(index)}
                              className="p-2 mt-5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                              aria-label="Remove criterion"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                              What this means (for this assignment)
                            </label>
                            <textarea
                              value={row.description}
                              onChange={(e) => updateCustomRow(index, { description: e.target.value })}
                              rows={2}
                              placeholder="Describe what earns full vs partial credit here…"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addCustomRow}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 font-bold text-sm hover:bg-indigo-50/50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add rubric row
                    </button>

                    {rubricMode === 'custom' && customCriteria.length > 0 && (!customRowsValid || !customBalanced) && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        {!customRowsValid
                          ? 'Each row needs a name and at least 1 point.'
                          : `Point totals must match: currently ${customAllocated} vs ${rubricTotalPoints} required.`}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAssessment(false);
                      resetAssessmentForm();
                    }}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      rubricMode === 'custom' && (!customBalanced || !customRowsValid)
                    }
                    className="flex-1 py-3 px-6 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Assessment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
