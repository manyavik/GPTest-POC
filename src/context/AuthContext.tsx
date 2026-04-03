import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setRole: (role: 'teacher' | 'student') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: Initializing auth listener");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthProvider: Auth state changed", firebaseUser?.email);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            console.log("AuthProvider: User doc found", userDoc.data());
            setUser(userDoc.data() as User);
          } else {
            console.log("AuthProvider: User doc not found, creating default");
            const defaultUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              role: 'student', // Default role
            };
            setUser(defaultUser);
          }
        } catch (error) {
          console.error("AuthProvider: Error fetching user doc", error);
          // Fallback to basic user info if Firestore fails
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            role: 'student',
          } as User);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const setRole = async (role: 'teacher' | 'student') => {
    if (!auth.currentUser) {
      console.error("setRole: No current user");
      return;
    }
    console.log("setRole: Setting role to", role);
    const userData: User = {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || '',
      displayName: auth.currentUser.displayName || '',
      role,
    };
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), userData);
      setUser(userData);
      console.log("setRole: Role set successfully");
    } catch (error) {
      console.error("setRole: Error saving role", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
