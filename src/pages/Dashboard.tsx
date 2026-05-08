import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, BookOpen, ArrowRight, Hash, Trash2 } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, arrayUnion, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Class } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadError(null);
    setLoading(true);

    const q = user.role === 'teacher' 
      ? query(collection(db, 'classes'), where('teacherId', '==', user.uid))
      : query(collection(db, 'classes'), where('studentIds', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const classList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
        setClasses(classList);
        setLoading(false);
      },
      (error) => {
        console.error('Dashboard classes query failed:', error);
        setLoadError(error.message || 'Could not load classes.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newClassName.trim()) return;

    const newClass = {
      name: newClassName,
      description: '',
      teacherId: user.uid,
      studentIds: [],
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    };

    setCreating(true);
    try {
      // Ensure Firestore role doc is present/updated so class create rules pass consistently.
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          role: 'teacher',
        },
        { merge: true }
      );
      await addDoc(collection(db, 'classes'), newClass);
      setNewClassName('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Create class failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not create class.';
      alert(
        `${msg}\n\nIf this says permission denied: deploy the latest firestore.rules to your named Firestore database, or ask the repo owner.`
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteCode.trim()) return;

    const code = inviteCode.trim().toUpperCase();
    setJoining(true);
    try {
      const q = query(collection(db, 'classes'), where('inviteCode', '==', code));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const classDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'classes', classDoc.id), {
          studentIds: arrayUnion(user.uid),
        });
        setInviteCode('');
        setShowJoinModal(false);
      } else {
        alert('Invalid invite code. Check with your teacher and try again.');
      }
    } catch (err) {
      console.error('Join class failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not join this class.';
      alert(msg);
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (window.confirm('Are you sure you want to delete this class?')) {
      await deleteDoc(doc(db, 'classes', classId));
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading classes...</div>;
  if (loadError) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border border-red-100 rounded-2xl text-red-800">
        <p className="font-bold mb-2">Could not load dashboard</p>
        <p className="text-sm leading-relaxed">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.displayName}</h1>
          <p className="text-gray-500 mt-1">Manage your academic journey with GPTest.</p>
        </div>
        
        {user?.role === 'teacher' ? (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Create Class
          </button>
        ) : (
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Join Class
          </button>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No classes yet</h3>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">
            {user?.role === 'teacher' 
              ? "Start by creating your first classroom to manage assessments and students."
              : "Ask your teacher for an invite code to join a classroom."}
          </p>
          <button
            onClick={() => user?.role === 'teacher' ? setShowCreateModal(true) : setShowJoinModal(true)}
            className="text-indigo-600 font-bold hover:underline"
          >
            {user?.role === 'teacher' ? "Create a class now" : "Join a class now"}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <motion.div
              key={cls.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                    <SchoolIcon className="w-6 h-6" />
                  </div>
                  {user?.role === 'teacher' && (
                    <button 
                      onClick={() => handleDeleteClass(cls.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{cls.name}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {cls.studentIds.length} Students
                  </div>
                  {user?.role === 'teacher' && (
                    <div className="flex items-center gap-1 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                      <Hash className="w-3 h-3" />
                      {cls.inviteCode}
                    </div>
                  )}
                </div>
                <Link
                  to={`/class/${cls.id}`}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-900 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all"
                >
                  Enter Class <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showCreateModal || showJoinModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6">
                {showCreateModal ? 'Create New Class' : 'Join a Class'}
              </h2>
              <form onSubmit={showCreateModal ? handleCreateClass : handleJoinClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {showCreateModal ? 'Class Name' : 'Invite Code'}
                  </label>
                  <input
                    type="text"
                    required
                    value={showCreateModal ? newClassName : inviteCode}
                    onChange={(e) => showCreateModal ? setNewClassName(e.target.value) : setInviteCode(e.target.value)}
                    placeholder={showCreateModal ? "e.g. Advanced Literature" : "ABCDEF"}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none uppercase"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); setShowJoinModal(false); }}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={(showCreateModal && creating) || (!showCreateModal && joining)}
                    className="flex-1 py-3 px-6 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {showCreateModal ? (creating ? 'Creating…' : 'Create') : joining ? 'Joining…' : 'Join'}
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

function SchoolIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
