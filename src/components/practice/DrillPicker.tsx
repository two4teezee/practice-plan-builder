'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Drill, DRILL_CATEGORIES } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Search, Plus, Clock, Target } from 'lucide-react';

interface DrillPickerProps {
  onAdd: (drill: Drill) => void;
  addedDrillIds: number[];
}

export function DrillPicker({ onAdd, addedDrillIds }: DrillPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const drills = useLiveQuery(
    () => db.drills.orderBy('name').toArray(),
    []
  );

  const filteredDrills = drills?.filter((drill) => {
    const matchesSearch = drill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || drill.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...DRILL_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  const categoryColors: Record<string, string> = {
    Skating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Shooting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Passing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Defensive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Offensive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drills..."
            className="pl-9 py-2 text-sm"
          />
        </div>
        <div className="w-40">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={categoryOptions}
            className="py-2 text-sm"
          />
        </div>
      </div>

      {/* Drills List */}
      <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
        {filteredDrills?.map((drill) => {
          const isAdded = drill.id !== undefined && addedDrillIds.includes(drill.id);
          return (
            <Card key={drill.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {drill.name}
                    </h4>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${categoryColors[drill.category]}`}>
                      {drill.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{drill.duration}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span>{drill.skillFocus}</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isAdded ? 'secondary' : 'primary'}
                  onClick={() => onAdd(drill)}
                  disabled={isAdded}
                >
                  <Plus className="w-4 h-4" />
                  {isAdded ? 'Added' : 'Add'}
                </Button>
              </div>
            </Card>
          );
        })}
        {filteredDrills?.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No drills found
          </div>
        )}
      </div>
    </div>
  );
}
