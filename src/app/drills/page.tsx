'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Drill, DRILL_CATEGORIES } from '@/lib/types';
import { DrillCard } from '@/components/drills/DrillCard';
import { DrillForm } from '@/components/drills/DrillForm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Plus, Search, Library, Download, Printer } from 'lucide-react';
import { exportDrillsLibraryToPDF, exportDrillsLibraryToWord } from '@/lib/export';

export default function DrillsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const drills = useLiveQuery(
    () => db.drills.orderBy('name').toArray(),
    []
  );

  const filteredDrills = drills?.filter((drill) => {
    const matchesSearch = drill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.objective.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || drill.category === categoryFilter;
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

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...DRILL_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

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

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drills..."
            className="pl-10"
          />
        </div>
        <div className="sm:w-48">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={categoryOptions}
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
            {searchQuery || categoryFilter !== 'all' ? 'No drills found' : 'No drills yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery || categoryFilter !== 'all' 
              ? 'Try adjusting your search or filter'
              : 'Create your first drill to get started'}
          </p>
          {!searchQuery && categoryFilter === 'all' && (
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
