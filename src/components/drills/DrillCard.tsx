'use client';

import { Drill } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, Target, Edit, Trash2, Plus, ExternalLink } from 'lucide-react';

interface DrillCardProps {
  drill: Drill;
  onEdit?: (drill: Drill) => void;
  onDelete?: (drill: Drill) => void;
  onAdd?: (drill: Drill) => void;
  showAddButton?: boolean;
}

export function DrillCard({ drill, onEdit, onDelete, onAdd, showAddButton = false }: DrillCardProps) {
  const categoryColors: Record<string, string> = {
    Admin: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    Skating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Shooting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Passing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Defensive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Offensive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <Card className="p-4" hover>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {drill.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
              {drill.description || drill.objective || 'No description'}
            </p>
          </div>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap ${categoryColors[drill.category]}`}>
            {drill.category}
          </span>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{drill.duration}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4" />
            <span>{drill.skillFocus}</span>
          </div>
        </div>

        {/* Equipment */}
        {drill.equipment && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            <span className="font-medium">Equipment:</span> {drill.equipment}
          </p>
        )}

        {/* Links */}
        {(drill.videoLink || drill.pdfLink) && (
          <div className="flex gap-2">
            {drill.videoLink && (
              <a
                href={drill.videoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Video
              </a>
            )}
            {drill.pdfLink && (
              <a
                href={drill.pdfLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                PDF
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          {showAddButton && onAdd && (
            <Button size="sm" onClick={() => onAdd(drill)}>
              <Plus className="w-4 h-4" />
              Add
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="ghost" onClick={() => onEdit(drill)}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(drill)} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
