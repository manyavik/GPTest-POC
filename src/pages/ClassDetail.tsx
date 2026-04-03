import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, FileText, ChevronRight, Users, Settings, ArrowLeft, Trash2 } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Class, Assessment } from '../types';
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
    if (!classId || !newTitle.trim()) return;

    const newAssessment = {
      classId,
      teacherId: user.uid,
      title: newTitle,
      prompt: newPrompt,
      dueDate: newDueDate,
      rubric: {
        criteria: [
          { name: 'Clarity', description: 'Clear and concise expression of ideas.', maxPoints: 10 },
          { name: 'Accuracy', description: 'Factual correctness and relevance.', maxPoints: 10 },
          { name: 'Structure', description: 'Logical flow and organization.', maxPoints: 10 }
        ]
      }
    };

    await addDoc(collection(db, 'assessments'), newAssessment);
    setNewTitle('');
    setNewPrompt('');
    setNewDueDate('');
    setShowCreateAssessment(false);
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
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Due: {assessment.dueDate ? new Date(assessment.dueDate).toLocaleDateString() : 'No deadline'}
                    </span>
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
              <h2 className="text-2xl font-bold mb-6">Create New Assessment</h2>
              <form onSubmit={handleCreateAssessment} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Essay on Climate Change"
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
                    type="datetime-local"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-700 mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Default Rubric Applied
                  </h4>
                  <p className="text-sm text-indigo-600">
                    Assessments are automatically graded on Clarity, Accuracy, and Structure (10pts each). You can customize these later.
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateAssessment(false)}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-6 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
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
