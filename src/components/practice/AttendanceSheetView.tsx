'use client';

import type { PlayerAttendance, AttendanceSide } from '@/lib/types';
import type { AttendanceSheetColumn } from '@/lib/attendance';
import { buildAttendanceSheet, attendanceSummary, positionLabel } from '@/lib/attendance';

const SIDE_CLASS: Record<AttendanceSide | 'N/A', string> = {
  Home: 'text-blue-700 dark:text-blue-300',
  Away: 'text-amber-700 dark:text-amber-300',
  'N/A': 'text-gray-400 dark:text-gray-500',
};

// Compact read-only attendance table: one column per group, staff at the top of each
export function AttendanceSheetView({ attendance }: { attendance: PlayerAttendance[] | undefined }) {
  const sheet = buildAttendanceSheet(attendance);
  if (!sheet) return null;
  const isSingleColumn = sheet.columns.length === 1;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
        <span className="font-semibold text-gray-900 dark:text-white">Attendance</span>
        <span className="text-gray-500 dark:text-gray-400">{attendanceSummary(sheet)}</span>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid divide-x divide-gray-200 dark:divide-gray-800"
          style={{ gridTemplateColumns: `repeat(${sheet.columns.length}, minmax(9rem, 1fr))` }}
        >
          {sheet.columns.map(column => (
            <SheetColumn key={column.key} column={column} spread={isSingleColumn} />
          ))}
        </div>
      </div>

      {sheet.absent.length > 0 && (
        <p className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
          <span className="font-medium">Absent ({sheet.absent.length}):</span> {sheet.absent.join(', ')}
        </p>
      )}
    </div>
  );
}

// spread: a lone column flows into several text columns instead of one long list
function SheetColumn({ column, spread }: { column: AttendanceSheetColumn; spread: boolean }) {
  return (
    <div className="min-w-0">
      <div className="px-2 py-1 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
        {column.name} <span className="font-normal text-gray-400">({column.people.length})</span>
      </div>
      <ul className={`py-0.5 ${spread ? 'columns-2 sm:columns-3 gap-x-4' : ''}`}>
        {column.people.map((person, index) => {
          const label = positionLabel(person.position);
          const endsStaff = person.isStaff && column.people[index + 1] && !column.people[index + 1].isStaff;
          const side = person.side ?? 'N/A';
          return (
            <li
              key={person.id}
              className={`flex items-baseline justify-between gap-2 px-2 py-0.5 break-inside-avoid ${
                endsStaff ? 'border-b border-dashed border-gray-200 dark:border-gray-700 pb-1 mb-0.5' : ''
              }`}
            >
              <span className={`truncate ${person.isStaff ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                {person.name}
                {label && <span className="ml-1 text-[10px] font-normal text-gray-400">{label}</span>}
              </span>
              {!person.isStaff && (
                <span className={`flex-shrink-0 text-[10px] font-medium ${SIDE_CLASS[side]}`}>{side}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
