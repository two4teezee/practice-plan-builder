'use client';

import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TeamGroup } from '@/lib/types';

// Shared by every text field and select in Team Manager: same height and radius as a size="sm" Button
export const TEAM_FIELD_CLASS_NAME =
  'h-9 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 px-3 text-sm';

// A select with its own chevron inset from the edge; the native arrow sits too close to it
export function TeamSelect({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${TEAM_FIELD_CLASS_NAME} appearance-none pr-9 cursor-pointer ${className}`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
    </div>
  );
}

interface GroupSelectProps {
  groups: TeamGroup[];
  value: string | null;
  onChange: (groupId: string | null) => void;
  className?: string;
}

// Pick a player's Team Group (or none)
export function GroupSelect({ groups, value, onChange, className }: GroupSelectProps) {
  return (
    <TeamSelect
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={className}
      aria-label="Group"
    >
      <option value="">No group</option>
      {groups.map(group => (
        <option key={group.id} value={group.id}>{group.name}</option>
      ))}
    </TeamSelect>
  );
}
