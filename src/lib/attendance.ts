import type { AttendanceSide, PlayerAttendance, PlayerPosition } from './types';
import { ATTENDANCE_SIDES, isStaffPosition, normalizePlayerPosition } from './types';

// ============================================
// Attendance sheet: a saved plan's Attendance laid out as one column per Team Group,
// shared by the Previous Plans view and the PDF export
// ============================================

// Staff first, then players
const SHEET_POSITION_ORDER: PlayerPosition[] = ['Coach', 'Assistant Coach', 'Skater', 'Goalie'];

export interface AttendanceSheetPerson {
  id: string;
  name: string;
  position: PlayerPosition;
  isStaff: boolean;
  side: AttendanceSide | null;
}

export interface AttendanceSheetColumn {
  key: string;
  name: string;
  people: AttendanceSheetPerson[];  // Present people only
}

export interface AttendanceSheet {
  columns: AttendanceSheetColumn[];
  absent: string[];
  presentCount: number;
  total: number;
  sideCounts: { side: AttendanceSide; count: number }[];
}

const NO_GROUP_KEY = '__no-group__';

// Short role label shown beside a name ("Coach", "Asst. Coach", "Goalie"); skaters get none
export function positionLabel(position: PlayerPosition): string {
  if (position === 'Assistant Coach') return 'Asst. Coach';
  if (position === 'Skater') return '';
  return position;
}

// Built from the saved snapshot alone, so it reads the same after the Roster changes.
// Returns null when there's nothing to show (no attendance, or saved before snapshots existed).
export function buildAttendanceSheet(attendance: PlayerAttendance[] | undefined): AttendanceSheet | null {
  const entries = (attendance ?? []).filter(entry => entry.name);
  if (entries.length === 0) return null;

  // Columns follow the saved order, which is Team Group order with unassigned last
  const columns = new Map<string, AttendanceSheetColumn>();
  const absent: string[] = [];
  for (const entry of entries) {
    const key = entry.groupId ?? NO_GROUP_KEY;
    if (!columns.has(key)) {
      columns.set(key, { key, name: entry.groupId ? entry.groupName || 'Group' : 'No group', people: [] });
    }
    if (!entry.present) {
      absent.push(entry.name!);
      continue;
    }
    const position = normalizePlayerPosition(entry.position);
    const isStaff = isStaffPosition(position);
    columns.get(key)!.people.push({
      id: entry.playerId,
      name: entry.name!,
      position,
      isStaff,
      side: isStaff ? null : entry.side ?? null,
    });
  }

  for (const column of columns.values()) {
    column.people.sort((a, b) =>
      SHEET_POSITION_ORDER.indexOf(a.position) - SHEET_POSITION_ORDER.indexOf(b.position) ||
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  }

  const present = entries.filter(entry => entry.present);
  const nonEmptyColumns = Array.from(columns.values()).filter(column => column.people.length > 0);
  // A lone unassigned column is simply everyone who came
  if (nonEmptyColumns.length === 1 && nonEmptyColumns[0].key === NO_GROUP_KEY) {
    nonEmptyColumns[0].name = 'Present';
  }

  return {
    columns: nonEmptyColumns,
    absent,
    presentCount: present.length,
    total: entries.length,
    sideCounts: ATTENDANCE_SIDES.map(side => ({
      side,
      count: present.filter(entry => entry.side === side && !isStaffPosition(normalizePlayerPosition(entry.position))).length,
    })),
  };
}

// "14 of 16 present · Home 7 · Away 6" (sides with nobody on them are left out)
export function attendanceSummary(sheet: AttendanceSheet): string {
  return [
    `${sheet.presentCount} of ${sheet.total} present`,
    ...sheet.sideCounts.filter(s => s.count > 0).map(s => `${s.side} ${s.count}`),
  ].join(' · ');
}
