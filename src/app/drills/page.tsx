'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Drill, DrillCategory } from '@/lib/types';
import { DRILL_CATEGORIES } from '@/lib/types';
import { DrillCard } from '@/components/drills/DrillCard';
import { DrillForm } from '@/components/drills/DrillForm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Search, Library } from 'lucide-react';
import { LAYOUT_STYLES } from '@/lib/layoutConfig';

const CATEGORY_FILTER_STORAGE_KEY = 'drills-category-filter';

export default function DrillsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<DrillCategory>>(
    new Set(DRILL_CATEGORIES)
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved category filter from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CATEGORY_FILTER_STORAGE_KEY);
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
        CATEGORY_FILTER_STORAGE_KEY,
        JSON.stringify(Array.from(selectedCategories))
      );
    } catch (error) {
      console.error('Failed to save category filter:', error);
    }
  }, [selectedCategories, isLoaded]);

  const isAllSelected = selectedCategories.size === DRILL_CATEGORIES.length;

  const selectAll = () => {
    setSelectedCategories(new Set(DRILL_CATEGORIES));
  };

  const toggleCategory = (category: DrillCategory) => {
    setSelectedCategories((prev) => {
      // If all are currently selected, switch to just this category
      if (prev.size === DRILL_CATEGORIES.length) {
        return new Set([category]);
      }
      
      const next = new Set(prev);
      if (next.has(category)) {
        // Don't allow deselecting all categories
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
      drill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.objective.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategories.has(drill.category);
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (drillData: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    if (editingDrill?.id) {
      await db.drills.update(editingDrill.id, {
        ...drillData,
        updatedAt: now,
      });
    } else {
      await db.drills.add({
        ...drillData,
        createdAt: now,
        updatedAt: now,
      });
    }
    setIsModalOpen(false);
    setEditingDrill(null);
  };

  const handleSaveAsNew = async (drillData: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    await db.drills.add({
      ...drillData,
      createdAt: now,
      updatedAt: now,
    });
    setIsModalOpen(false);
    setEditingDrill(null);
  };

  const handleCardClick = (drill: Drill) => {
    setEditingDrill(drill);
    setIsModalOpen(true);
  };

  const handleDelete = async (drill: Drill) => {
    if (drill.id) {
      await db.drills.delete(drill.id);
      setIsModalOpen(false);
      setEditingDrill(null);
    }
  };

  const handleNewDrill = () => {
    setEditingDrill(null);
    setIsModalOpen(true);
  };

  const categoryColors: Record<string, string> = {
    Admin: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600',
    Skating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    Shooting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700',
    Passing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700',
    Defensive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    Offensive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    Scrimmage: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600',
  };

  // Layout config - see src/lib/layoutConfig.ts to adjust
  const S = LAYOUT_STYLES;

  return (
    <div className="mx-auto" style={S.container}>
      {/* Header */}
      <div style={S.pageHeaderWrapper}>
        <div className="flex items-center gap-2 mb-1">
          <Library 
            className="text-primary-600 dark:text-primary-400" 
            style={S.pageHeaderIcon}
          />
          <h1 
            className="font-bold text-gray-900 dark:text-white"
            style={S.pageHeaderTitle}
          >
            Drills Library
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400" style={S.pageHeaderSubtitle}>
          Browse, create, and manage your hockey drills
        </p>
      </div>

      {/* Search and Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drills..."
            className="pl-9 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleNewDrill}>
          <Plus className="w-4 h-4" />
          New Drill
        </Button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {/* All pill */}
        <button
          type="button"
          onClick={selectAll}
          className={`
            px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
            ${isAllSelected
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border-primary-300 dark:border-primary-700 border-2'
              : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-80'
            }
          `}
        >
          All
        </button>
        {DRILL_CATEGORIES.map((category) => {
          const isSelected = selectedCategories.has(category) && !isAllSelected;
          return (
            <button
              type="button"
              key={category}
              onClick={() => toggleCategory(category)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                ${isSelected
                  ? `${categoryColors[category]} border-2`
                  : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-80'
                }
              `}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Drills Grid */}
      {filteredDrills && filteredDrills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredDrills.map((drill) => (
            <DrillCard
              key={drill.id}
              drill={drill}
              onClick={handleCardClick}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <Library className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            {searchQuery || selectedCategories.size < DRILL_CATEGORIES.length ? 'No drills found' : 'No drills yet'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {searchQuery || selectedCategories.size < DRILL_CATEGORIES.length
              ? 'Try adjusting your search or filter'
              : 'Create your first drill to get started'}
          </p>
          {!searchQuery && selectedCategories.size === DRILL_CATEGORIES.length && (
            <Button size="sm" onClick={handleNewDrill}>
              <Plus className="w-4 h-4" />
              Create First Drill
            </Button>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDrill(null);
        }}
        title={editingDrill ? 'Edit Drill' : 'Create New Drill'}
        size="drill"
      >
        <DrillForm
          drill={editingDrill}
          onSave={handleSave}
          onCreateNew={editingDrill ? handleSaveAsNew : undefined}
          onDelete={editingDrill ? handleDelete : undefined}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingDrill(null);
          }}
        />
      </Modal>
    </div>
  );
}
