import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  /** Ignore stale profile updates while setRole is writing users/{uid}. */
  const profileWriteLock = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          let userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            userDoc = await getDoc(userRef);
          }
          if (profileWriteLock.current) {
            setLoading(false);
            return;
          }
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              role: 'student',
            });
          }
        } catch (error) {
          console.error('AuthProvider: Error fetching user doc', error);
          if (!profileWriteLock.current) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              role: 'student',
            } as User);
          }
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
      console.error('setRole: No current user');
      return;
    }
    const userData: User = {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || '',
      displayName: auth.currentUser.displayName || '',
      role,
    };
    profileWriteLock.current = true;
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), userData);
      setUser(userData);
    } catch (error) {
      console.error('setRole: Error saving role', error);
      throw error;
    } finally {
      profileWriteLock.current = false;
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