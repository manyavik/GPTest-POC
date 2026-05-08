import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, School, CheckCircle, ArrowRight } from 'lucide-react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAuth, AUTH_PENDING_ROLE_KEY, AUTH_POST_LOGIN_NAV_KEY } from '../context/AuthContext';

export default function Home() {
  const { user, setRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    // In some hosted redirect flows, sessionStorage keys may be unavailable/lost.
    // Always take authenticated users to dashboard to avoid landing-page stalls.
    const to = sessionStorage.getItem(AUTH_POST_LOGIN_NAV_KEY) || '/dashboard';
    sessionStorage.removeItem(AUTH_POST_LOGIN_NAV_KEY);
    navigate(to, { replace: true });
  }, [user, navigate]);

  const handleLogin = async (role: 'teacher' | 'student') => {
    console.log("Home: Starting login for role", role);
    try {
      if (!auth.currentUser) {
        sessionStorage.setItem(AUTH_PENDING_ROLE_KEY, role);
        try {
          // Popup is usually more reliable on custom-hosted domains (e.g. Railway).
          await signInWithPopup(auth, googleProvider);
        } catch (popupError: unknown) {
          const popupCode =
            typeof popupError === 'object' &&
            popupError !== null &&
            'code' in popupError &&
            typeof (popupError as { code?: unknown }).code === 'string'
              ? (popupError as { code: string }).code
              : '';

          // Fallback to redirect when popup is blocked or cannot be opened.
          if (
            popupCode === 'auth/popup-blocked' ||
            popupCode === 'auth/popup-closed-by-user' ||
            popupCode === 'auth/cancelled-popup-request'
          ) {
            await signInWithRedirect(auth, googleProvider);
            return;
          }
          throw popupError;
        }
      }
      console.log("Home: User authenticated, setting role");
      await setRole(role);
      console.log("Home: Role set, navigating to dashboard");
      navigate('/dashboard');
    } catch (error) {
      console.error("Home: Login Error:", error);
      const message =
        error instanceof Error ? error.message : "Something went wrong during login.";
      alert(`Login failed: ${message}`);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"
        >
          <BookOpen className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back!</h1>
          <p className="text-gray-600 mb-8">You are logged in as <span className="font-semibold">{user.email}</span></p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mb-4"
          >
            Go to Dashboard <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">Need to change your role?</p>
            <div className="flex gap-2">
              <button 
                onClick={() => handleLogin('teacher')}
                className="flex-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 py-2 rounded-lg transition-colors"
              >
                Switch to Teacher
              </button>
              <button 
                onClick={() => handleLogin('student')}
                className="flex-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 py-2 rounded-lg transition-colors"
              >
                Switch to Student
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-indigo-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 lg:pt-32 lg:pb-48">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-indigo-50 rounded-full blur-3xl -z-10 opacity-50" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold mb-8 border border-indigo-100"
          >
            <CheckCircle className="w-4 h-4" />
            AI-Powered Academic Scoring
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl lg:text-8xl font-black tracking-tight mb-8 leading-tight"
          >
            GPTest: The Future of <br />
            <span className="text-indigo-600">Automated Grading</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Empower teachers and engage students with instant, rubric-based AI feedback. 
            Iterative learning, simplified.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={() => handleLogin('teacher')}
              className="group flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
            >
              <School className="w-6 h-6" />
              I'm a Teacher
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => handleLogin('student')}
              className="group flex items-center gap-3 px-8 py-4 bg-white text-indigo-600 border-2 border-indigo-600 rounded-2xl font-bold text-lg hover:bg-indigo-50 transition-all"
            >
              <GraduationCap className="w-6 h-6" />
              I'm a Student
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <BookOpen className="w-8 h-8 text-indigo-600" />,
                title: "Class Management",
                desc: "Organize assessments and students effortlessly in a centralized hub."
              },
              {
                icon: <CheckCircle className="w-8 h-8 text-indigo-600" />,
                title: "Instant Scoring",
                desc: "AI generates scores and constructive feedback based on your custom rubrics."
              },
              {
                icon: <GraduationCap className="w-8 h-8 text-indigo-600" />,
                title: "Iterative Learning",
                desc: "Teachers can revise AI scores, fostering a collaborative feedback loop."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-6">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
