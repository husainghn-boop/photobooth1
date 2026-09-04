/**
 * Authentication service for Supabase
 * Manages authentication state and operations
 */

import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

export type AuthState = 'unauthenticated' | 'loading' | 'authenticated';

export type UserType = 'registered' | 'anonymous' | null;

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  userType: UserType;
  authState: AuthState;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInAsGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  restoreSession: () => Promise<void>;
}

/**
 * Get the user type based on the JWT claims
 */
export function getUserType(user: User | null): UserType {
  if (!user) return null;
  const isAnonymous = user.aud === 'authenticated' && user.user_metadata?.provider === 'anonymous';
  return isAnonymous ? 'anonymous' : user.email ? 'registered' : null;
}

export async function getIsAdmin(user: User | null): Promise<boolean> {
  if (getUserType(user) !== 'registered') return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return {
        error: error.message || 'Failed to sign in',
      };
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { error: message };
  }
}

/**
 * Create a new account with email and password
 */
export async function signUp(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return {
        session: null,
        requiresConfirmation: false,
        error: error.message || 'Failed to create account',
      };
    }
    // Check if email confirmation is required (no session returned)
    const requiresConfirmation = !data.session;
    return {
      session: data.session,
      requiresConfirmation,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return {
      session: null,
      requiresConfirmation: false,
      error: message,
    };
  }
}

/**
 * Sign in as guest with anonymous authentication
 */
export async function signInAsGuest() {
  try {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      return {
        error: error.message || 'Failed to sign in as guest',
      };
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { error: message };
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return {
        error: error.message || 'Failed to sign out',
      };
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { error: message };
  }
}

/**
 * Get the current session
 */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return { session: null, error };
    }
    return { session: data.session, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('Error getting session:', message);
    return { session: null, error: { message } };
  }
}

/**
 * Subscribe to auth state changes
 * Returns unsubscribe function
 */
export function onAuthStateChange(callback: (session: Session | null, user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, session?.user || null);
  });

  // Return unsubscribe function
  return () => {
    data?.subscription?.unsubscribe();
  };
}
