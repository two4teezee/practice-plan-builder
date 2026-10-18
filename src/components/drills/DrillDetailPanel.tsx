'use client';

import Image from 'next/image';
import { Clock, Pencil, ExternalLink } from 'lucide-react';
import type { Drill } from '@/lib/types';
import { getTagColor, parseVariations } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSketchImagePreview } from '@/lib/sketch';
import { categoryBadgeClass } from '@/components/drills/DrillCategoryHeader';

interface DrillDetailPanelProps {
  drill: Drill;
  onEdit: (drill: Drill) => void;
}

// Read-only view of one drill, shown beside the list in the Drills Library's list layout
export function DrillDetailPanel({ drill, onEdit }: DrillDetailPanelProps) {
  // Full image once loaded; the thumbnail until then
  const sketchImage = getSketchImagePreview(drill.sketchData) || drill.sketchThumbnail || null;
  const variations = parseVariations(drill.variations);

  const sections: { title: string; text: string }[] = [
    { title: 'Description', text: drill.description },
    { title: 'Objective', text: drill.objective },
    { title: 'Setup', text: drill.setup },
    { title: 'Execution', text: drill.execution },
    { title: 'Coaching Points', text: drill.coachingPoints },
  ].filter(section => section.text?.trim());

  return (
    <Card className="p-4 min-w-0 space-y-4">
      {/* Title + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{drill.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
            <span className={`px-2 py-0.5 font-semibold rounded ${categoryBadgeClass(drill.category)}`}>
              {drill.category}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {drill.duration}
            </span>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onEdit(drill)}>
          <Pencil className="w-4 h-4" />
          Edit
        </Button>
      </div>

      {sketchImage && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
          <Image
            src={sketchImage}
            alt={`Sketch for ${drill.name}`}
            width={900}
            height={400}
            className="w-full max-h-[22rem] object-contain"
            unoptimized
          />
        </div>
      )}

      {sections.map(section => (
        <div key={section.title}>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{section.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{section.text}</p>
        </div>
      ))}

      {variations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variations</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
            {variations.map((variation, index) => (
              <li key={`${index}-${variation}`}>{variation}</li>
            ))}
          </ul>
        </div>
      )}

      {drill.equipment && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-0.5">Equipment</p>
          <p className="text-sm text-amber-700 dark:text-amber-400">{drill.equipment}</p>
        </div>
      )}

      {drill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {drill.tags.map(tag => (
            <span key={tag} className={`px-2 py-0.5 text-xs font-medium rounded ${getTagColor(tag)}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {(drill.videoLink || drill.pdfLink) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {drill.videoLink && (
            <a href={drill.videoLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" />
              Video
            </a>
          )}
          {drill.pdfLink && (
            <a href={drill.pdfLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" />
              PDF
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
