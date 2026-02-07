'use client';

import type { Drill } from '@/lib/types';
import { getTagColor } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, ExternalLink } from 'lucide-react';

interface DrillCardProps {
  drill: Drill;
  onClick?: (drill: Drill) => void;
  onAdd?: (drill: Drill) => void;
  showAddButton?: boolean;
  maxTags?: number;
}

export function DrillCard({ drill, onClick, onAdd, showAddButton = false, maxTags = 4 }: DrillCardProps) {
  const categoryColors: Record<string, string> = {
    Admin: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    Conditioning: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    Skating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Shooting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Passing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Defensive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Offensive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Goalie: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Scrimmage: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(drill);
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAdd) {
      onAdd(drill);
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card 
      className={`p-4 h-[140px] flex flex-col ${onClick ? 'cursor-pointer' : ''}`} 
      hover={!!onClick}
      onClick={handleCardClick}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {drill.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
              {drill.description || drill.objective || drill.coachingPoints ||'No description'}
            </p>
          </div>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap ${categoryColors[drill.category]}`}>
            {drill.category}
          </span>
        </div>

        {/* Spacer to push content to bottom */}
        <div className="flex-1" />

        {/* Bottom row with tags/links and optional add button */}
        <div className="flex items-end justify-between mt-2">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* Tags */}
            {drill.tags && drill.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                {drill.tags.slice(0, maxTags).map(tag => (
                  <span
                    key={tag}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getTagColor(tag)}`}
                  >
                    {tag}
                  </span>
                ))}
                {drill.tags.length > maxTags && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    +{drill.tags.length - maxTags} more
                  </span>
                )}
              </div>
            )}

            {/* Links */}
            {(drill.videoLink || drill.pdfLink) && (
              <div className="flex gap-2">
                {drill.videoLink && (
                  <a
                    href={drill.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLinkClick}
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
                    onClick={handleLinkClick}
                    className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    PDF
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Add button for picker mode */}
          {showAddButton && onAdd && (
            <Button size="sm" onClick={handleAddClick}>
              <Plus className="w-4 h-4" />
              Add
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
