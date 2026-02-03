'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db, refreshPlanDrillData } from '@/lib/db';
import type { PracticePlan, TimelineItem, DrillItem, ParallelSplitItem } from '@/lib/types';
import { flattenTimelineDrills, getTimelineItemDuration, secondsToDurationString } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { 
  exportPracticePlanToPDF, 
  exportPracticePlanToWord, 
  printPracticePlan 
} from '@/lib/export';
import { 
  History, 
  Calendar, 
  Clock, 
  MapPin, 
  FileText,
  Download,
  Printer,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Image as ImageIcon
} from 'lucide-react';
import { LAYOUT_STYLES } from '@/lib/layoutConfig';

// Helper to extract image preview from sketch data
function getSketchImagePreview(sketchData?: string): string | null {
  if (!sketchData) return null;
  try {
    const data = JSON.parse(sketchData);
    return data.imagePreview || null;
  } catch {
    return null;
  }
}

// Component to render a single drill item
function DrillItemView({ item, index }: { item: DrillItem; index?: number }) {
  const duration = item.customDuration || item.drill.duration;
  const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
  const sketchImage = getSketchImagePreview(item.drill.sketchData);
  
  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        {index !== undefined && (
          <span className="w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-full text-xs font-bold text-primary-700 dark:text-primary-300">
            {index + 1}
          </span>
        )}
        <span className="font-medium text-gray-900 dark:text-white text-sm flex-1">
          {item.drill.name}
        </span>
        {sketchImage && <ImageIcon className="w-3.5 h-3.5 text-gray-400" />}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {duration}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {item.drill.category}
        </span>
      </div>
      {hasVariations && (
        <div className="mt-1.5 ml-9 flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Variations:</span>
          <span className="text-[10px] text-gray-600 dark:text-gray-400">
            {item.selectedVariations!.join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

// Component to render a parallel split
function ParallelSplitView({ item }: { item: ParallelSplitItem }) {
  const duration = getTimelineItemDuration(item);
  return (
    <div className="border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-lg p-3 bg-primary-50/50 dark:bg-primary-900/20">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
          Parallel Groups ({item.groups.length})
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {secondsToDurationString(duration)}
        </span>
      </div>
      <div className={`grid gap-3 ${
        item.groups.length === 2 ? 'grid-cols-2' :
        item.groups.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
      }`}>
        {item.groups.map(group => (
          <div 
            key={group.id} 
            className="rounded-lg border-2 overflow-hidden"
            style={{ borderColor: group.color + '40' }}
          >
            <div 
              className="px-2 py-1.5 text-xs font-medium"
              style={{ backgroundColor: group.color + '20', color: group.color }}
            >
              {group.name} ({group.items.length})
            </div>
            <div className="p-2 space-y-1 bg-white dark:bg-gray-800">
              {group.items.map((groupItem) => (
                <TimelineItemView key={groupItem.id} item={groupItem} compact />
              ))}
              {group.items.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No drills</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component to render any timeline item
function TimelineItemView({ item, index, compact = false }: { item: TimelineItem; index?: number; compact?: boolean }) {
  if (item.type === 'drill') {
    if (compact) {
      const duration = item.customDuration || item.drill.duration;
      const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
      return (
        <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white truncate flex-1">
              {item.drill.name}
            </span>
            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
              {duration}
            </span>
          </div>
          {hasVariations && (
            <div className="mt-1 text-[10px] text-gray-600 dark:text-gray-400 truncate">
              Vars: {item.selectedVariations!.join(', ')}
            </div>
          )}
        </div>
      );
    }
    return <DrillItemView item={item} index={index} />;
  }
  return <ParallelSplitView item={item} />;
}

// Detailed drill view for modal
function DrillItemModalView({ item, index }: { item: DrillItem; index: number }) {
  const duration = item.customDuration || item.drill.duration;
  const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
  const sketchImage = getSketchImagePreview(item.drill.sketchData);
  
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-full font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">
          {index + 1}
        </span>
        <div className={`flex-1 min-w-0 ${sketchImage ? 'flex gap-4' : ''}`}>
          {/* Text content */}
          <div className={sketchImage ? 'flex-1 min-w-0' : ''}>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white">{item.drill.name}</h4>
              <span className="text-sm text-gray-500 dark:text-gray-400">{duration}</span>
              {item.customDuration && item.customDuration !== item.drill.duration && (
                <span className="text-xs text-primary-600 dark:text-primary-400">(modified)</span>
              )}
            </div>
            {item.drill.objective && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                <strong>Objective:</strong> {item.drill.objective}
              </p>
            )}
            {item.drill.execution && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                <strong>Execution:</strong> {item.drill.execution}
              </p>
            )}
            {item.drill.coachingPoints && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                <strong>Coaching Points:</strong> {item.drill.coachingPoints}
              </p>
            )}
            {hasVariations && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Variations:</strong> {item.selectedVariations!.join(', ')}
              </p>
            )}
          </div>
          {/* Sketch Image - right column */}
          {sketchImage && (
            <div className="flex-shrink-0 w-48 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white self-start">
              <img 
                src={sketchImage} 
                alt={`Sketch for ${item.drill.name}`}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Detailed parallel split view for modal
function ParallelSplitModalView({ item }: { item: ParallelSplitItem }) {
  const duration = getTimelineItemDuration(item);
  return (
    <div className="border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl p-4 bg-primary-50/50 dark:bg-primary-900/20">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        <span className="font-semibold text-primary-700 dark:text-primary-300">
          Parallel Groups
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({item.groups.length} groups, {secondsToDurationString(duration)})
        </span>
      </div>
      <div className={`grid gap-4 ${
        item.groups.length === 2 ? 'grid-cols-2' :
        item.groups.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'
      }`}>
        {item.groups.map(group => (
          <div 
            key={group.id} 
            className="rounded-lg border-2 overflow-hidden bg-white dark:bg-gray-800"
            style={{ borderColor: group.color + '60' }}
          >
            <div 
              className="px-3 py-2 font-medium text-sm"
              style={{ backgroundColor: group.color + '20', color: group.color }}
            >
              {group.name}
            </div>
            <div className="p-3 space-y-2">
              {group.items.map((groupItem, idx) => (
                <TimelineItemModalView key={groupItem.id} item={groupItem} index={idx} nested />
              ))}
              {group.items.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">No drills</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Timeline item for modal (with full details)
function TimelineItemModalView({ item, index, nested = false }: { item: TimelineItem; index: number; nested?: boolean }) {
  if (item.type === 'drill') {
    if (nested) {
      const duration = item.customDuration || item.drill.duration;
      const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
      const sketchImage = getSketchImagePreview(item.drill.sketchData);
      return (
        <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className={sketchImage ? 'flex gap-2' : ''}>
            {/* Text content */}
            <div className={sketchImage ? 'flex-1 min-w-0' : ''}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-gray-900 dark:text-white">{item.drill.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{duration}</span>
              </div>
              {item.drill.objective && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {item.drill.objective}
                </p>
              )}
              {hasVariations && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Variations:</strong> {item.selectedVariations!.join(', ')}
                </p>
              )}
            </div>
            {/* Sketch - right column */}
            {sketchImage && (
              <div className="flex-shrink-0 w-24 border border-gray-200 dark:border-gray-600 rounded overflow-hidden bg-white self-start">
                <img 
                  src={sketchImage} 
                  alt={`Sketch for ${item.drill.name}`}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      );
    }
    return <DrillItemModalView item={item} index={index} />;
  }
  return <ParallelSplitModalView item={item} />;
}

export default function HistoryPage() {
  const [selectedPlan, setSelectedPlan] = useState<PracticePlan | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  const practicePlans = useLiveQuery(
    async () => {
      const plans = await db.practicePlans.orderBy('createdAt').reverse().toArray();
      // Ensure all plans have timeline and refresh drill data (for updated sketches, etc.)
      const refreshedPlans = await Promise.all(
        plans.map(plan => refreshPlanDrillData(plan))
      );
      return refreshedPlans;
    },
    []
  );

  const handleDelete = async (plan: PracticePlan) => {
    if (plan.id && confirm(`Are you sure you want to delete "${plan.name}"?`)) {
      await db.practicePlans.delete(plan.id);
    }
  };

  const handleView = (plan: PracticePlan) => {
    setSelectedPlan(plan);
    setIsViewModalOpen(true);
  };

  const handleExportPDF = async (plan: PracticePlan) => {
    await exportPracticePlanToPDF(plan);
  };

  const handleExportWord = async (plan: PracticePlan) => {
    await exportPracticePlanToWord(plan);
  };

  const handlePrint = async (plan: PracticePlan) => {
    await printPracticePlan(plan);
  };

  const toggleExpand = (planId: number | undefined) => {
    if (planId === undefined) return;
    setExpandedPlanId(expandedPlanId === planId ? null : planId);
  };

  // Layout config - see src/lib/layoutConfig.ts to adjust
  const S = LAYOUT_STYLES;

  return (
    <div className="mx-auto" style={S.container}>
      {/* Header */}
      <div style={S.pageHeaderWrapper}>
        <div className="flex items-center gap-2 mb-1">
          <History 
            className="text-primary-600 dark:text-primary-400" 
            style={S.pageHeaderIcon}
          />
          <h1 
            className="font-bold text-gray-900 dark:text-white"
            style={S.pageHeaderTitle}
          >
            Previous Practice Plans
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400" style={S.pageHeaderSubtitle}>
          View, export, and manage your saved practice plans
        </p>
      </div>

      {/* Practice Plans List */}
      {practicePlans && practicePlans.length > 0 ? (
        <div className="space-y-3">
          {practicePlans.map((plan) => {
            const practiceDate = plan.date instanceof Date ? plan.date : new Date(plan.date);
            const isExpanded = expandedPlanId === plan.id;
            
            return (
              <Card key={plan.id} className="overflow-hidden" style={S.card}>
                {/* Main Info */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {plan.name}
                      </h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{format(practiceDate, 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{plan.duration}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{plan.location}</span>
                        </div>
                      </div>
                      {plan.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleView(plan)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(plan.id)}>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Drills Summary */}
                  {(() => {
                    const allDrills = plan.timeline ? flattenTimelineDrills(plan.timeline) : [];
                    const hasParallel = plan.timeline?.some(item => item.type === 'parallel');
                    return (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {allDrills.length} drill{allDrills.length !== 1 ? 's' : ''}
                        </span>
                        {hasParallel && (
                          <span className="flex items-center gap-0.5 text-[10px] text-primary-600 dark:text-primary-400">
                            <GitBranch className="w-2.5 h-2.5" />
                            Groups
                          </span>
                        )}
                        <div className="flex gap-1 ml-1">
                          {allDrills.slice(0, 3).map((d) => (
                            <span 
                              key={d.id} 
                              className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            >
                              {d.drill.name}
                            </span>
                          ))}
                          {allDrills.length > 3 && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              +{allDrills.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
                    {/* Export Buttons */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Button size="sm" variant="secondary" onClick={() => handleExportPDF(plan)}>
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleExportWord(plan)}>
                        <Download className="w-3.5 h-3.5" />
                        Word
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handlePrint(plan)}>
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDelete(plan)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>

                    {/* Timeline Items */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Practice Plan:</h4>
                      {plan.timeline && plan.timeline.length > 0 ? (
                        <div className="space-y-2">
                          {plan.timeline.map((item, index) => (
                            <TimelineItemView key={item.id} item={item} index={item.type === 'drill' ? index : undefined} />
                          ))}
                        </div>
                      ) : (
                        // Fallback to legacy drills if no timeline
                        plan.drills.map((item, index) => (
                          <div 
                            key={item.id} 
                            className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <span className="w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-full text-xs font-bold text-primary-700 dark:text-primary-300">
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                              {item.drill.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.drill.duration}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {item.drill.category}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Equipment and Notes */}
                    {plan.equipment && (
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Equipment:</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{plan.equipment}</p>
                      </div>
                    )}
                    {plan.notes && (
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Notes:</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{plan.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <History className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            No practice plans yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create your first practice plan to see it here
          </p>
        </div>
      )}

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedPlan(null);
        }}
        title={selectedPlan?.name || 'Practice Plan'}
        size="lg"
      >
        {selectedPlan && (
          <div className="space-y-6">
            {/* Practice Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(selectedPlan.date instanceof Date ? selectedPlan.date : new Date(selectedPlan.date), 'MMMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedPlan.duration}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedPlan.location}</p>
              </div>
            </div>

            {selectedPlan.description && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Description</p>
                <p className="text-gray-900 dark:text-white">{selectedPlan.description}</p>
              </div>
            )}

            {selectedPlan.equipment && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">Equipment Needed</p>
                <p className="text-amber-700 dark:text-amber-400">{selectedPlan.equipment}</p>
              </div>
            )}

            {/* Practice Timeline */}
            <div>
              {(() => {
                const allDrills = selectedPlan.timeline ? flattenTimelineDrills(selectedPlan.timeline) : [];
                return (
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Practice Plan ({allDrills.length} drills)
                  </h3>
                );
              })()}
              <div className="space-y-3">
                {selectedPlan.timeline && selectedPlan.timeline.length > 0 ? (
                  selectedPlan.timeline.map((item, index) => (
                    <TimelineItemModalView key={item.id} item={item} index={index} />
                  ))
                ) : (
                  // Fallback to legacy drills
                  selectedPlan.drills.map((item, index) => (
                    <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-full font-bold text-primary-700 dark:text-primary-300">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{item.drill.name}</h4>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{item.drill.duration}</span>
                          </div>
                          {item.drill.objective && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <strong>Objective:</strong> {item.drill.objective}
                            </p>
                          )}
                          {item.drill.execution && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <strong>Execution:</strong> {item.drill.execution}
                            </p>
                          )}
                          {item.drill.coachingPoints && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              <strong>Coaching Points:</strong> {item.drill.coachingPoints}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedPlan.notes && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Notes</p>
                <p className="text-blue-700 dark:text-blue-400">{selectedPlan.notes}</p>
              </div>
            )}

            {/* Export Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <Button variant="secondary" onClick={() => handleExportPDF(selectedPlan)}>
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
              <Button variant="secondary" onClick={() => handleExportWord(selectedPlan)}>
                <Download className="w-4 h-4" />
                Export Word
              </Button>
              <Button variant="secondary" onClick={() => handlePrint(selectedPlan)}>
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
