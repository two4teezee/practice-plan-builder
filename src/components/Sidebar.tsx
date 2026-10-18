'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ClipboardList, 
  Library, 
  History, 
  Users,
  Sun, 
  Moon,
  Menu,
  X,
  LogOut,
  User,
  MessageSquare
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

const navItems = [
  {
    name: 'Create Practice Plan',
    href: '/',
    icon: ClipboardList,
  },
  {
    name: 'Drills Library',
    href: '/drills',
    icon: Library,
  },
  {
    name: 'Team Manager',
    href: '/teams',
    icon: Users,
  },
  {
    name: 'Previous Plans',
    href: '/history',
    icon: History,
  },
];

// Shared look for every icon in the rail
const railItemClass = 'group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200';
const railIdleClass = 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white';

// Label that appears to the right of a rail icon on hover or keyboard focus
function RailTooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
    >
      {children}
    </span>
  );
}

interface SidebarProps {
  onFeedbackClick?: () => void;
}

export function Sidebar({ onFeedbackClick }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { profile, signOut, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  const handleFeedbackClick = () => {
    onFeedbackClick?.();
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
      >
        {mobileMenuOpen ? (
          <X className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        )}
      </button>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-black/50 z-30 cursor-default"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar: an icon rail; each icon names itself in a tooltip */}
      <aside
        className={`
          fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40
          w-20 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          flex flex-col items-center h-screen
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        {/* Extra top space on mobile keeps the logo clear of the menu toggle */}
        <div className="pt-16 pb-5 lg:pt-5 border-b border-gray-200 dark:border-gray-800 w-full flex justify-center">
          <div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"
            title="Practice Planner"
          >
            <span className="text-white font-bold text-xl" aria-hidden>🏒</span>
            <span className="sr-only">Practice Planner</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-label={item.name}
                aria-current={isActive ? 'page' : undefined}
                className={`${railItemClass} ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : railIdleClass
                }`}
              >
                <item.icon className="w-6 h-6" />
                <RailTooltip>{item.name}</RailTooltip>
              </Link>
            );
          })}
        </nav>

        {/* User & Actions */}
        <div className="py-4 border-t border-gray-200 dark:border-gray-800 w-full flex flex-col items-center gap-2">
          {isAuthenticated && profile && (
            <div
              tabIndex={0}
              aria-label={[profile.fullName, profile.email].filter(Boolean).join(', ')}
              className={`${railItemClass} cursor-default outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
            >
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <RailTooltip>
                {profile.fullName && <span className="block">{profile.fullName}</span>}
                <span className={profile.fullName ? 'block font-normal text-gray-300' : 'block'}>{profile.email}</span>
              </RailTooltip>
            </div>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            className={`${railItemClass} ${railIdleClass}`}
          >
            {mounted && (theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />)}
            <RailTooltip>{mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</RailTooltip>
          </button>

          <button
            type="button"
            onClick={handleFeedbackClick}
            aria-label="Feedback"
            className={`${railItemClass} ${railIdleClass}`}
          >
            <MessageSquare className="w-6 h-6" />
            <RailTooltip>Feedback</RailTooltip>
          </button>

          {isAuthenticated && (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign Out"
              className={`${railItemClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
            >
              <LogOut className="w-6 h-6" />
              <RailTooltip>Sign Out</RailTooltip>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
