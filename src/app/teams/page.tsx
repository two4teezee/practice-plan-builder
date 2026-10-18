'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getTeams, createTeam, updateTeam, deleteTeam } from '@/lib/db';
import type { Team, Player, PlayerPosition } from '@/lib/types';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import {
  PLAYER_POSITIONS,
  getTeamGroupColor,
  createTeamGroup,
  createPlayer,
  comparePlayers,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GroupSelect, TeamSelect, TEAM_FIELD_CLASS_NAME } from '@/components/teams/GroupSelect';
import { Users, Plus, Trash2, UserPlus, Check, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { LAYOUT_STYLES } from '@/lib/layoutConfig';

const AUTOSAVE_DELAY_MS = 600;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const fieldClassName = TEAM_FIELD_CLASS_NAME;
// Text buttons match the field height
const buttonClassName = 'h-9 whitespace-nowrap';
// Roster header, rows and the add form share one grid so the columns line up
// Name gets twice the room of position and group; the last column holds the row's actions
const ROSTER_GRID = 'grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_5rem] gap-x-3 gap-y-2 items-center';
// Read-only cell text lines up with the text inside the fields
const ROSTER_CELL = 'h-9 flex items-center px-3 min-w-0 text-sm';
// Group rows and the add-group form share one grid
const GROUP_GRID = 'grid grid-cols-[minmax(0,1fr)_5.5rem_2.25rem] gap-2 items-center';

export default function TeamManagerPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  // Working copy of the selected team; edits autosave after a short pause
  const [draft, setDraft] = useState<Team | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const [newTeamName, setNewTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newPlayer, setNewPlayer] = useState(() => createPlayer());
  // The one roster row open for editing; the rest are read-only
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  const pendingSaveRef = useRef<Team | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const S = LAYOUT_STYLES;

  useEffect(() => {
    getTeams()
      .then(data => {
        setTeams(data);
        if (data[0]?.id) {
          setSelectedTeamId(data[0].id);
          setDraft(data[0]);
        }
      })
      .catch(error => console.error('Failed to fetch teams:', error))
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (team: Team) => {
    if (!team.id || !team.name.trim()) return;
    setSaveState('saving');
    try {
      const saved = await updateTeam(team.id, {
        name: team.name.trim(),
        groups: team.groups,
        players: team.players,
      });
      setTeams(prev => prev.map(t => (t.id === saved.id ? saved : t)));
      setSaveState('saved');
    } catch (error) {
      console.error('Failed to save team:', error);
      setSaveState('error');
    }
  }, []);

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending) void persist(pending);
  }, [persist]);

  // Don't drop an edit made just before leaving the page
  useEffect(() => flushPendingSave, [flushPendingSave]);

  const editTeam = (updater: (team: Team) => Team) => {
    if (!draft) return;
    const next = updater(draft);
    setDraft(next);
    pendingSaveRef.current = next;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushPendingSave, AUTOSAVE_DELAY_MS);
  };

  const selectTeam = (team: Team) => {
    flushPendingSave();
    setSelectedTeamId(team.id ?? null);
    setDraft(team);
    setSaveState('idle');
    setNewGroupName('');
    setNewPlayer(createPlayer());
    setEditingPlayerId(null);
  };

  const isDuplicateTeamName = (name: string, exceptId?: string) =>
    teams.some(t => t.id !== exceptId && t.name.trim().toLowerCase() === name.trim().toLowerCase());

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    if (isDuplicateTeamName(name)) {
      alert('A team with this name already exists.');
      return;
    }
    setIsCreating(true);
    try {
      const team = await createTeam({ name, groups: [], players: [] });
      setTeams(prev => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTeamName('');
      selectTeam(team);
    } catch (error) {
      console.error('Failed to create team:', error);
      alert('Failed to create team. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!draft?.id) return;
    if (!confirm(`Delete "${draft.name}" and its roster? Practice plans keep the team name but lose their roster link.`)) {
      return;
    }
    // Drop any pending autosave for the team being deleted
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingSaveRef.current = null;
    try {
      await deleteTeam(draft.id);
      const remaining = teams.filter(t => t.id !== draft.id);
      setTeams(remaining);
      setSelectedTeamId(remaining[0]?.id ?? null);
      setDraft(remaining[0] ?? null);
      setSaveState('idle');
    } catch (error) {
      console.error('Failed to delete team:', error);
      alert('Failed to delete team. Please try again.');
    }
  };

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    if (!name || !draft) return;
    if (draft.groups.some(g => g.name.trim().toLowerCase() === name.toLowerCase())) {
      alert('This team already has a group with that name.');
      return;
    }
    editTeam(team => ({ ...team, groups: [...team.groups, createTeamGroup(name)] }));
    setNewGroupName('');
  };

  const handleRemoveGroup = (groupId: string) => {
    if (!draft) return;
    const group = draft.groups.find(g => g.id === groupId);
    const assigned = draft.players.filter(p => p.groupId === groupId).length;
    if (assigned > 0 && !confirm(`Remove "${group?.name}"? ${assigned} player(s) will be left unassigned.`)) {
      return;
    }
    editTeam(team => ({
      ...team,
      groups: team.groups.filter(g => g.id !== groupId),
      players: team.players.map(p => (p.groupId === groupId ? { ...p, groupId: null } : p)),
    }));
  };

  const handleAddPlayer = () => {
    if (!newPlayer.name.trim()) return;
    const player = { ...newPlayer, name: newPlayer.name.trim() };
    editTeam(team => ({ ...team, players: [...team.players, player].sort(comparePlayers) }));
    // Keep the chosen position and group so several similar players can be added in a row
    setNewPlayer(createPlayer({ position: newPlayer.position, groupId: newPlayer.groupId }));
  };

  const updatePlayer = (playerId: string, fields: Partial<Player>) => {
    editTeam(team => ({
      ...team,
      players: team.players.map(p => (p.id === playerId ? { ...p, ...fields } : p)),
    }));
  };

  const removePlayer = (playerId: string) => {
    if (editingPlayerId === playerId) setEditingPlayerId(null);
    editTeam(team => ({ ...team, players: team.players.filter(p => p.id !== playerId) }));
  };

  const groupPlayerCounts = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const player of draft?.players ?? []) {
      counts.set(player.groupId, (counts.get(player.groupId) ?? 0) + 1);
    }
    return counts;
  }, [draft]);

  const groupOptions = draft?.groups ?? [];
  const draftNameError = draft && !draft.name.trim()
    ? 'Team name is required'
    : draft && isDuplicateTeamName(draft.name, draft.id)
      ? 'Another team already has this name'
      : undefined;

  return (
    <ProtectedRoute>
      <div className="mx-auto" style={S.container}>
        {/* Header */}
        <div style={S.pageHeaderWrapper}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="text-primary-600 dark:text-primary-400" style={S.pageHeaderIcon} />
            <h1 className="font-bold text-gray-900 dark:text-white" style={S.pageHeaderTitle}>
              Team Manager
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400" style={S.pageHeaderSubtitle}>
            Create teams, manage rosters, and assign players to groups
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 items-start">
          {/* Team list */}
          <Card className="p-4">
            <SectionHeader title="Teams" />
            <form
              className="flex gap-2 mb-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateTeam();
              }}
            >
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="New team name"
                className={fieldClassName}
                aria-label="New team name"
              />
              <Button type="submit" size="sm" className={buttonClassName} disabled={!newTeamName.trim() || isCreating}>
                <Plus className="w-4 h-4" />
                Create
              </Button>
            </form>

            {isLoading ? (
              <EmptyText>Loading teams...</EmptyText>
            ) : teams.length === 0 ? (
              <EmptyText>No teams yet. Create your first team above.</EmptyText>
            ) : (
              <ul className="space-y-1">
                {teams.map(team => {
                  const isSelected = team.id === selectedTeamId;
                  const shown = isSelected && draft ? draft : team;
                  return (
                    <li key={team.id}>
                      <button
                        type="button"
                        onClick={() => selectTeam(team)}
                        className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span className="block text-sm font-medium truncate">{shown.name || 'Untitled team'}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {pluralize(shown.players.length, 'person', 'people')}
                          {' · '}
                          {pluralize(shown.groups.length, 'group', 'groups')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Team editor */}
          {!draft ? (
            <Card className="p-4">
              <EmptyText>{isLoading ? 'Loading...' : 'Select or create a team to manage its roster.'}</EmptyText>
            </Card>
          ) : (
            // Team details (1/3) beside the roster (2/3); stacked below xl, where a third is too narrow
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 items-start min-w-0">
              <div className="space-y-3 min-w-0">
                <Card className="p-4">
                  <SectionHeader
                    title="Team Name"
                    description="Shown in the Team dropdown when building a practice plan."
                    action={<SaveIndicator state={draftNameError ? 'idle' : saveState} />}
                  />
                  <div className="flex gap-2">
                    <input
                      id="team-name"
                      value={draft.name}
                      onChange={(e) => editTeam(team => ({ ...team, name: e.target.value }))}
                      className={`${fieldClassName} ${draftNameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                      aria-label="Team name"
                      aria-invalid={!!draftNameError}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteTeam}
                      className={`${buttonClassName} text-red-600 dark:text-red-400`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Team
                    </Button>
                  </div>
                  {draftNameError && (
                    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{draftNameError}</p>
                  )}
                </Card>

                {/* Groups */}
                <Card className="p-4">
                  <SectionHeader
                    title="Default Groups"
                    description="Presets: everyone starts in their default group when you take attendance, and split groups in this team's practice plans are named after these groups, in order (up to 4)."
                  />
                  <div className="space-y-2">
                    {draft.groups.length === 0 && <EmptyText align="left">No default groups yet.</EmptyText>}
                    {draft.groups.map((group, index) => {
                      const count = groupPlayerCounts.get(group.id) ?? 0;
                      return (
                        <div key={group.id} className={GROUP_GRID}>
                          <div className="relative">
                            <span
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: getTeamGroupColor(index) }}
                            />
                            <input
                              value={group.name}
                              onChange={(e) =>
                                editTeam(team => ({
                                  ...team,
                                  groups: team.groups.map(g => (g.id === group.id ? { ...g, name: e.target.value } : g)),
                                }))
                              }
                              className={`${fieldClassName} pl-8`}
                              aria-label="Group name"
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 text-right">
                            {pluralize(count, 'person', 'people')}
                          </span>
                          <IconButton
                          onClick={() => handleRemoveGroup(group.id)}
                          aria-label={`Remove ${group.name}`}
                          className="hover:text-red-600 dark:hover:text-red-400"
                        >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </div>
                      );
                    })}
                    <form
                      className={GROUP_GRID}
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddGroup();
                      }}
                    >
                      <input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="New group, e.g. Red, Line 1"
                        className={fieldClassName}
                        aria-label="New group name"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className={`${buttonClassName} col-span-2`}
                        disabled={!newGroupName.trim()}
                      >
                        <Plus className="w-4 h-4" />
                        Add Group
                      </Button>
                    </form>
                  </div>
                </Card>
              </div>

              {/* Roster */}
              <Card className="p-4">
                <SectionHeader title="Roster" count={draft.players.length} />

                {/* Add row, on top so new people go in without scrolling */}
                <form
                  className={`${ROSTER_GRID} pb-3 mb-3 border-b border-gray-200 dark:border-gray-800`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddPlayer();
                  }}
                >
                  <input
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    placeholder="Add a name"
                    className={fieldClassName}
                    aria-label="New roster name"
                  />
                  <PositionSelect
                    value={newPlayer.position}
                    onChange={(position) => setNewPlayer({ ...newPlayer, position })}
                  />
                  <GroupSelect
                    groups={groupOptions}
                    value={newPlayer.groupId}
                    onChange={(groupId) => setNewPlayer({ ...newPlayer, groupId })}
                  />
                  <Button type="submit" size="sm" className={`${buttonClassName} w-full`} disabled={!newPlayer.name.trim()}>
                    <UserPlus className="w-4 h-4" />
                    Add
                  </Button>
                </form>

                {draft.players.length === 0 ? (
                  <EmptyText>No one on the roster yet.</EmptyText>
                ) : (
                  <>
                    <div className={`${ROSTER_GRID} hidden sm:grid pb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400`}>
                      <span className="px-3">Name</span>
                      <span className="px-3">Position</span>
                      <span className="px-3">Default Group</span>
                      <span />
                    </div>
                    <div className="space-y-1">
                      {draft.players.map(player => {
                        const isEditing = player.id === editingPlayerId;
                        const groupIndex = draft.groups.findIndex(g => g.id === player.groupId);
                        const group = groupIndex >= 0 ? draft.groups[groupIndex] : null;
                        return (
                          <div
                            key={player.id}
                            className={`${ROSTER_GRID} rounded-xl ${
                              isEditing
                                ? 'bg-primary-50/60 dark:bg-primary-900/20 p-1 -mx-1'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                            }`}
                            onKeyDown={(e) => {
                              if (isEditing && (e.key === 'Escape' || (e.key === 'Enter' && e.target instanceof HTMLInputElement))) {
                                setEditingPlayerId(null);
                              }
                            }}
                          >
                            {isEditing ? (
                              <>
                                <input
                                  value={player.name}
                                  onChange={(e) => updatePlayer(player.id, { name: e.target.value })}
                                  className={fieldClassName}
                                  aria-label="Name"
                                  autoFocus
                                />
                                <PositionSelect
                                  value={player.position}
                                  onChange={(position) => updatePlayer(player.id, { position })}
                                />
                                <GroupSelect
                                  groups={groupOptions}
                                  value={player.groupId}
                                  onChange={(groupId) => updatePlayer(player.id, { groupId })}
                                />
                              </>
                            ) : (
                              <>
                                <span className={`${ROSTER_CELL} font-medium text-gray-900 dark:text-white`}>
                                  <span className="truncate">{player.name || 'Unnamed'}</span>
                                </span>
                                <span className={`${ROSTER_CELL} text-gray-700 dark:text-gray-300`}>
                                  <span className="truncate">{player.position}</span>
                                </span>
                                <span className={`${ROSTER_CELL} gap-2 ${group ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                                  {group && (
                                    <span
                                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: getTeamGroupColor(groupIndex) }}
                                    />
                                  )}
                                  <span className="truncate">{group ? group.name : 'No group'}</span>
                                </span>
                              </>
                            )}
                            <div className="flex justify-end gap-1">
                              {isEditing ? (
                                <IconButton
                                  onClick={() => setEditingPlayerId(null)}
                                  aria-label={`Done editing ${player.name}`}
                                  title="Done"
                                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                                >
                                  <Check className="w-4 h-4" />
                                </IconButton>
                              ) : (
                                <IconButton
                                  onClick={() => setEditingPlayerId(player.id)}
                                  aria-label={`Edit ${player.name}`}
                                  title="Edit"
                                  className="hover:text-primary-600 dark:hover:text-primary-400"
                                >
                                  <Pencil className="w-4 h-4" />
                                </IconButton>
                              )}
                              <IconButton
                                onClick={() => removePlayer(player.id)}
                                aria-label={`Remove ${player.name}`}
                                title="Remove"
                                className="hover:text-red-600 dark:hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </IconButton>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function SectionHeader({
  title,
  description,
  count,
  action,
}: {
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
          {count !== undefined && (
            <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">({count})</span>
          )}
        </h2>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyText({ children, align = 'center' }: { children: ReactNode; align?: 'center' | 'left' }) {
  return (
    <p className={`text-sm text-gray-500 dark:text-gray-400 py-3 ${align === 'center' ? 'text-center' : ''}`}>
      {children}
    </p>
  );
}

// Square, field-height button for row actions
function IconButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`h-9 w-9 flex-shrink-0 inline-flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
      {...props}
    />
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
      {state === 'saving' && (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>)}
      {state === 'saved' && (<><Check className="w-3.5 h-3.5 text-green-600" /> Saved</>)}
      {state === 'error' && (<><AlertCircle className="w-3.5 h-3.5 text-red-600" /> Save failed</>)}
    </span>
  );
}

function PositionSelect({ value, onChange }: { value: PlayerPosition; onChange: (position: PlayerPosition) => void }) {
  return (
    <TeamSelect value={value} onChange={(e) => onChange(e.target.value as PlayerPosition)} aria-label="Position">
      {PLAYER_POSITIONS.map(position => (
        <option key={position} value={position}>{position}</option>
      ))}
    </TeamSelect>
  );
}
