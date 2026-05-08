import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import ClassDetail from './pages/ClassDetail';
import AssessmentDetail from './pages/AssessmentDetail';
import SubmissionDetail from './pages/SubmissionDetail';
import { Layout } from './components/Layout';
import { auth } from './firebase';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  // Avoid redirect loops during auth-context hydration right after login.
  if (loading || (!user && auth.currentUser)) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  return user ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/class/:classId" element={<PrivateRoute><Layout><ClassDetail /></Layout></PrivateRoute>} />
          <Route path="/assessment/:assessmentId" element={<PrivateRoute><Layout><AssessmentDetail /></Layout></PrivateRoute>} />
          <Route path="/submission/:submissionId" element={<PrivateRoute><Layout><SubmissionDetail /></Layout></PrivateRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
