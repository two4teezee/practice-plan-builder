'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Drill, DRILL_CATEGORIES, DrillCategory } from '@/lib/types';
import { DrillCard } from '@/components/drills/DrillCard';
import { DrillForm } from '@/components/drills/DrillForm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Search, Library, Download } from 'lucide-react';
import { exportDrillsLibraryToPDF, exportDrillsLibraryToWord } from '@/lib/export';

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

  const toggleCategory = (category: DrillCategory) => {
    setSelectedCategories((prev) => {
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

  const handleEdit = (drill: Drill) => {
    setEditingDrill(drill);
    setIsModalOpen(true);
  };

  const handleDelete = async (drill: Drill) => {
    if (drill.id && confirm(`Are you sure you want to delete "${drill.name}"?`)) {
      await db.drills.delete(drill.id);
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
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600',
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Library className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Drills Library
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Browse, create, and manage your hockey drills
        </p>
      </div>

      {/* Search and Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drills..."
            className="pl-10"
          />
        </div>
        {drills && drills.length > 0 && (
          <>
            <Button variant="secondary" onClick={() => drills && exportDrillsLibraryToPDF(drills)}>
              <Download className="w-4 h-4" />
              PDF
            </Button>
            <Button variant="secondary" onClick={() => drills && exportDrillsLibraryToWord(drills)}>
              <Download className="w-4 h-4" />
              Word
            </Button>
          </>
        )}
        <Button onClick={handleNewDrill}>
          <Plus className="w-5 h-5" />
          New Drill
        </Button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {DRILL_CATEGORIES.map((category) => {
          const isSelected = selectedCategories.has(category);
          return (
            <button
              type="button"
              key={category}
              onClick={() => toggleCategory(category)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrills.map((drill) => (
            <DrillCard
              key={drill.id}
              drill={drill}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <Library className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || selectedCategories.size < DRILL_CATEGORIES.length ? 'No drills found' : 'No drills yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery || selectedCategories.size < DRILL_CATEGORIES.length
              ? 'Try adjusting your search or filter'
              : 'Create your first drill to get started'}
          </p>
          {!searchQuery && selectedCategories.size === DRILL_CATEGORIES.length && (
            <Button onClick={handleNewDrill}>
              <Plus className="w-5 h-5" />
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
        size="lg"
      >
        <DrillForm
          drill={editingDrill}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingDrill(null);
          }}
        />
      </Modal>
    </div>
  );
}
