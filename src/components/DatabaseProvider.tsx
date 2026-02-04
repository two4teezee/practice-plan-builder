'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { initializeDatabase } from '@/lib/db';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        setIsReady(true);
      })
      .catch((err) => {
        // Log the error but don't block rendering
        // Authentication and RLS will handle access control
        console.error('Database initialization warning:', err);
        setIsReady(true);
      });
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
