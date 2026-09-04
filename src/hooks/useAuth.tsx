/**
 * React hook for authentication state management
 * Uses Supabase as the source of truth for auth state
 */

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSession, onAuthStateChange, getIsAdmin, getUserType, signInWithEmail, signInAsGuest, signOut } from '../services/authService';
import type { UserType } from '../services/authService';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<'unauthenticated' | 'loading' | 'authenticated'>('loading');
  const [userType, setUserType] = useState<UserType>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      setAuthState('loading');
      const { session: initialSession } = await getSession();

      if (initialSession?.user) {
        setSession(initialSession);
        setUser(initialSession.user);
        setUserType(getUserType(initialSession.user));
        setIsAdmin(await getIsAdmin(initialSession.user));
        setAuthState('authenticated');
      } else {
        setSession(null);
        setUser(null);
        setUserType(null);
        setIsAdmin(false);
        setAuthState('unauthenticated');
      }
    };

    initializeAuth();
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((newSession, newUser) => {
      setSession(newSession);
      setUser(newUser);
      setUserType(getUserType(newUser));
      void getIsAdmin(newUser).then(setIsAdmin);
      setAuthState(newUser ? 'authenticated' : 'unauthenticated');
    });

    return () => unsubscribe();
  }, []);

  return {
    session,
    user,
    userType,
    authState,
    isAuthenticated: authState === 'authenticated',
    isLoading: authState === 'loading',
    isAdmin,
    signInWithEmail,
    signInAsGuest,
    signOut,
  };
}
