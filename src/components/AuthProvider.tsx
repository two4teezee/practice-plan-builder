'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getProfile,
  onAuthStateChange,
  type Profile,
} from '@/lib/auth';

// ============================================
// Types
// ============================================

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isApproved: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const profileFetchInProgress = useRef(false);
  const hasInitialProfile = useRef(false);

  // Fetch profile for current user with timeout
  // If preserveOnFailure is true, keep existing profile if fetch fails
  const fetchProfile = useCallback(async (userId: string, preserveOnFailure: boolean = false) => {
    // Prevent duplicate fetches
    if (profileFetchInProgress.current) {
      return;
    }
    
    profileFetchInProgress.current = true;
    
    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );
      
      const profilePromise = getProfile(userId);
      
      const userProfile = await Promise.race([profilePromise, timeoutPromise]);
      
      if (userProfile) {
        setProfile(userProfile);
        hasInitialProfile.current = true;
      } else if (!preserveOnFailure) {
        // Only clear profile if we're not preserving on failure
        setProfile(null);
      }
      // If preserveOnFailure is true and fetch returned null, keep existing profile
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Only clear profile if we don't want to preserve and don't have one yet
      if (!preserveOnFailure && !hasInitialProfile.current) {
        setProfile(null);
      }
    } finally {
      profileFetchInProgress.current = false;
    }
  }, []);

  // Refresh profile (useful after approval)
  const refreshProfile = useCallback(async () => {
    if (user) {
      profileFetchInProgress.current = false; // Allow refresh
      await fetchProfile(user.id, false); // Don't preserve on manual refresh
    }
  }, [user, fetchProfile]);

  // Initialize auth state using onAuthStateChange only
  // This avoids race conditions between getSession and the listener
  useEffect(() => {
    let mounted = true;
    let isInitialEvent = true;

    // Subscribe to auth changes - this handles initial session too
    const { unsubscribe } = onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      console.log('Auth event:', event);
      
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // On initial load, don't preserve on failure (need to get real state)
        // On token refresh, preserve existing profile if fetch fails
        const shouldPreserve = !isInitialEvent && hasInitialProfile.current;
        await fetchProfile(newSession.user.id, shouldPreserve);
      } else {
        // User signed out
        setProfile(null);
        hasInitialProfile.current = false;
      }

      isInitialEvent = false;
      
      // Always set loading to false after processing any auth event
      setIsLoading(false);
    });

    // Fallback: if no auth event fires within 3 seconds, stop loading
    const fallbackTimer = setTimeout(() => {
      if (mounted && isLoading) {
        console.log('Auth fallback: no event received, stopping loading');
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [fetchProfile, isLoading]);

  // Sign in handler
  const handleSignIn = useCallback(async (email: string, password: string) => {
    const { user: signedInUser, error } = await authSignIn(email, password);
    
    if (error) {
      return { error };
    }

    if (signedInUser) {
      profileFetchInProgress.current = false; // Allow fresh fetch
      hasInitialProfile.current = false; // Reset for fresh login
      await fetchProfile(signedInUser.id, false);
    }

    return { error: null };
  }, [fetchProfile]);

  // Sign up handler
  const handleSignUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await authSignUp(email, password, fullName);
    return { error };
  }, []);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!user,
    isApproved: profile?.isApproved ?? false,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
