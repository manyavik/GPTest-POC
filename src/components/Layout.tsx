import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, User as UserIcon, LayoutDashboard } from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
                <BookOpen className="w-8 h-8" />
                <span>GPTest</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link to="/dashboard" className="text-gray-600 hover:text-indigo-600 flex items-center gap-2 font-medium">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                <UserIcon className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-700 capitalize">{user?.role}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} GPTest. AI-Powered Academic Feedback.
        </div>
      </footer>
    </div>
  );
}
