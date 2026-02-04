'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Routes that should not show the sidebar (auth pages)
const authRoutes = ['/login', '/register'];

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  
  // Check if current route is an auth page
  const isAuthPage = authRoutes.includes(pathname);

  // Auth pages get a simple layout without sidebar
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Protected pages get the full layout with sidebar
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 lg:ml-0 min-h-screen">
        <div className="p-2 lg:p-3 pt-14 lg:pt-3">
          {children}
        </div>
      </main>
    </div>
  );
}
