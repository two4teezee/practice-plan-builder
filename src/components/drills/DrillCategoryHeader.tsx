'use client';

import type { DrillCategory } from '@/lib/types';

const categoryBadgeColors: Partial<Record<DrillCategory, string>> = {
  Admin: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  Skating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Shooting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Passing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Defensive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Offensive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Goalie: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Scrimmage: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};
const fallbackBadgeColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';

// Color classes for a category badge
export function categoryBadgeClass(category: DrillCategory): string {
  return categoryBadgeColors[category] ?? fallbackBadgeColor;
}

interface DrillCategoryHeaderProps {
  category: DrillCategory;
  count: number;
  // Background matching the scrolling surface, so drills don't show through the sticky header
  className?: string;
}

// Sticky section header shown above each category when drills are sorted by category
export function DrillCategoryHeader({ category, count, className = '' }: DrillCategoryHeaderProps) {
  return (
    <div className={`sticky top-0 z-10 flex items-center gap-2 py-1.5 ${className}`}>
      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${categoryBadgeClass(category)}`}>
        {category}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{count}</span>
    </div>
  );
}
