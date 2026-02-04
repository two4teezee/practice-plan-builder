'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isApproved, isLoading, signOut, profile } = useAuth();

  useEffect(() => {
    // Redirect to login if not authenticated (and not loading)
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Not authenticated - will redirect, show nothing
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated but not approved - show pending message
  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Pending Approval
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Your account is awaiting administrator approval.
            </p>
            {profile?.email && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Logged in as: {profile.email}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Please check back later or contact your administrator.
            </p>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => signOut()}
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Authenticated and approved - render children
  return <>{children}</>;
}
