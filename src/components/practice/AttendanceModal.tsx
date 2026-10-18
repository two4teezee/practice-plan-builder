'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Users, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { GroupSelect } from '@/components/teams/GroupSelect';
import type { Team, PlayerAttendance, Player, AttendanceSide } from '@/lib/types';
import { resolveAttendance, comparePlayers, getTeamGroupColor, ATTENDANCE_SIDES, isStaffPosition } from '@/lib/types';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  team: Team | null;               // null when the team isn't in Team Manager
  attendance: PlayerAttendance[];
  onChange: (attendance: PlayerAttendance[]) => void;
}

const NO_GROUP_COLOR = '#9CA3AF';

export function AttendanceModal({ isOpen, onClose, teamName, team, attendance, onChange }: AttendanceModalProps) {
  const resolved = useMemo(
    () => (team ? resolveAttendance(team, attendance) : []),
    [team, attendance]
  );

  // Sections in Team Group order, then unassigned players
  const sections = useMemo(() => {
    if (!team) return [];
    const playersById = new Map(team.players.map(p => [p.id, p]));
    const rows = resolved
      .map(entry => ({ entry, player: playersById.get(entry.playerId)! }))
      .sort((a, b) => comparePlayers(a.player, b.player));
    const groupSections = team.groups.map((group, index) => ({
      key: group.id,
      name: group.name,
      color: getTeamGroupColor(index),
      rows: rows.filter(r => r.entry.groupId === group.id),
    }));
    const unassigned = rows.filter(r => r.entry.groupId === null);
    return [
      ...groupSections,
      ...(unassigned.length > 0 || groupSections.length === 0
        ? [{ key: 'none', name: 'No group', color: NO_GROUP_COLOR, rows: unassigned }]
        : []),
    ];
  }, [team, resolved]);

  const presentCount = resolved.filter(a => a.present).length;
  const sideCount = (side: AttendanceSide) => resolved.filter(a => a.present && a.side === side).length;

  const updateEntry = (playerId: string, fields: Partial<PlayerAttendance>) => {
    onChange(resolved.map(a => (a.playerId === playerId ? { ...a, ...fields } : a)));
  };

  const setAllPresent = (present: boolean) => {
    onChange(resolved.map(a => ({ ...a, present })));
  };

  const groupName = (groupId: string | null) =>
    team?.groups.find(g => g.id === groupId)?.name ?? null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Attendance${teamName ? ` — ${teamName}` : ''}`} size="lg">
      {!team ? (
        <div className="text-center py-6 space-y-3">
          <Users className="w-10 h-10 mx-auto text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {teamName
              ? <>&ldquo;{teamName}&rdquo; isn&rsquo;t in the Team Manager, so there&rsquo;s no roster to take attendance from.</>
              : 'Select a team first.'}
          </p>
          <Link href="/teams" className="inline-block text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
            Open Team Manager
          </Link>
        </div>
      ) : team.players.length === 0 ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">{team.name} has no players on its roster yet.</p>
          <Link href="/teams" className="inline-block text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
            Add players in Team Manager
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">{presentCount}</span> of {resolved.length} present
              {ATTENDANCE_SIDES.map(side => (
                <span key={side} className="text-gray-500 dark:text-gray-400"> · {side} {sideCount(side)}</span>
              ))}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAllPresent(true)}>All</Button>
              <Button size="sm" variant="outline" onClick={() => setAllPresent(false)}>None</Button>
            </div>
          </div>

          {sections.map(section => (
            <div key={section.key}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: section.color }} />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{section.name}</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {section.rows.filter(r => r.entry.present).length}/{section.rows.length}
                </span>
              </div>
              {section.rows.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 pl-5 mb-2">No players</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg">
                  {section.rows.map(({ entry, player }) => (
                    <AttendanceRow
                      key={player.id}
                      player={player}
                      entry={entry}
                      team={team}
                      defaultGroupName={groupName(player.groupId)}
                      onChange={(fields) => updateEntry(player.id, fields)}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="flex justify-end pt-1">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface AttendanceRowProps {
  player: Player;
  entry: PlayerAttendance;
  team: Team;
  defaultGroupName: string | null;  // null when the player has no Default Group
  onChange: (fields: Partial<PlayerAttendance>) => void;
}

function AttendanceRow({ player, entry, team, defaultGroupName, onChange }: AttendanceRowProps) {
  const isMoved = entry.groupId !== player.groupId;
  const resetLabel = defaultGroupName ?? 'no group';
  return (
    <li className={`flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-3 py-2 ${entry.present ? '' : 'opacity-50'}`}>
      <input
        type="checkbox"
        checked={entry.present}
        onChange={(e) => onChange({ present: e.target.checked })}
        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        aria-label={`${player.name} present`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-white truncate">{player.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {/* Only mention the Default Group when the player was moved out of a real one */}
          {[player.position, isMoved && defaultGroupName ? `Default group: ${defaultGroupName}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {/* Staff have no side; keep the space on wide screens so the group dropdowns stay aligned */}
      <div className={isStaffPosition(player.position) ? 'hidden sm:block sm:invisible' : ''} aria-hidden={isStaffPosition(player.position)}>
        <SideToggle value={entry.side} onChange={(side) => onChange({ side })} playerName={player.name} />
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isMoved && (
          <button
            type="button"
            onClick={() => onChange({ groupId: player.groupId })}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            title={`Reset to ${resetLabel}`}
            aria-label={`Reset ${player.name} to ${resetLabel}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="w-36">
          <GroupSelect groups={team.groups} value={entry.groupId} onChange={(groupId) => onChange({ groupId })} />
        </div>
      </div>
    </li>
  );
}

// Home / Away / N/A segmented control
function SideToggle({
  value,
  onChange,
  playerName,
}: {
  value: AttendanceSide | null;
  onChange: (side: AttendanceSide | null) => void;
  playerName: string;
}) {
  const options: { label: string; side: AttendanceSide | null }[] = [
    ...ATTENDANCE_SIDES.map(side => ({ label: side, side })),
    { label: 'N/A', side: null },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={`${playerName} side`}
      className="flex-shrink-0 inline-flex h-9 p-0.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
    >
      {options.map(({ label, side }) => {
        const isActive = value === side;
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(side)}
            className={`px-2.5 rounded-lg text-xs font-medium transition-colors ${
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
