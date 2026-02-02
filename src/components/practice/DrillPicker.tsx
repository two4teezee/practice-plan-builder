'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Drill, DRILL_CATEGORIES, DrillCategory } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Search, Plus, Clock, Target } from 'lucide-react';

const PICKER_CATEGORY_FILTER_KEY = 'drill-picker-category-filter';

interface DrillPickerProps {
  onAdd: (drill: Drill) => void;
  addedDrillIds: number[];
}

export function DrillPicker({ onAdd, addedDrillIds }: DrillPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<DrillCategory>>(
    new Set(DRILL_CATEGORIES)
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved category filter from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PICKER_CATEGORY_FILTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DrillCategory[];
        setSelectedCategories(new Set(parsed));
      }
    } catch (error) {
      console.error('Failed to load category filter:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save category filter to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        PICKER_CATEGORY_FILTER_KEY,
        JSON.stringify(Array.from(selectedCategories))
      );
    } catch (error) {
      console.error('Failed to save category filter:', error);
    }
  }, [selectedCategories, isLoaded]);

  const toggleCategory = (category: DrillCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        if (next.size > 1) {
          next.delete(category);
        }
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const drills = useLiveQuery(
    () => db.drills.orderBy('name').toArray(),
    []
  );

  const filteredDrills = drills?.filter((drill) => {
    const matchesSearch = drill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategories.has(drill.category);
    return matchesSearch && matchesCategory;
  });

  const categoryColors: Record<string, string> = {
    Admin: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600',
    Skating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    Shooting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700',
    Passing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700',
    Defensive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    Offensive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600',
  };

  const categoryBadgeColors: Record<string, string> = {
    Admin: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    Skating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Shooting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Passing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Defensive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Offensive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search drills..."
          className="pl-9 py-2 text-sm"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {DRILL_CATEGORIES.map((category) => {
          const isSelected = selectedCategories.has(category);
          return (
            <button
              type="button"
              key={category}
              onClick={() => toggleCategory(category)}
              className={`
                px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200
                ${isSelected
                  ? `${categoryColors[category]} border`
                  : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 opacity-50 hover:opacity-70'
                }
              `}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Drills List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${categoryBadgeColors[drill.category]}`}>
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
