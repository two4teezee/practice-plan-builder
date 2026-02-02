'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import { PracticePlan } from '@/lib/types';
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
  User, 
  FileText,
  Download,
  Printer,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function HistoryPage() {
  const [selectedPlan, setSelectedPlan] = useState<PracticePlan | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  const practicePlans = useLiveQuery(
    () => db.practicePlans.orderBy('createdAt').reverse().toArray(),
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

  const handlePrint = (plan: PracticePlan) => {
    printPracticePlan(plan);
  };

  const toggleExpand = (planId: number | undefined) => {
    if (planId === undefined) return;
    setExpandedPlanId(expandedPlanId === planId ? null : planId);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <History className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Previous Practice Plans
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          View, export, and manage your saved practice plans
        </p>
      </div>

      {/* Practice Plans List */}
      {practicePlans && practicePlans.length > 0 ? (
        <div className="space-y-4">
          {practicePlans.map((plan) => {
            const practiceDate = plan.date instanceof Date ? plan.date : new Date(plan.date);
            const isExpanded = expandedPlanId === plan.id;
            
            return (
              <Card key={plan.id} className="overflow-hidden">
                {/* Main Info */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {plan.name}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          <span>{format(practiceDate, 'MMMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{plan.duration}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          <span>{plan.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          <span>{plan.coach}</span>
                        </div>
                      </div>
                      {plan.description && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleView(plan)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(plan.id)}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Drills Summary */}
                  <div className="mt-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {plan.drills.length} drill{plan.drills.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-1.5 ml-2">
                      {plan.drills.slice(0, 3).map((d, i) => (
                        <span 
                          key={i} 
                          className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        >
                          {d.drill.name}
                        </span>
                      ))}
                      {plan.drills.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{plan.drills.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">
                    {/* Export Buttons */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Button size="sm" variant="secondary" onClick={() => handleExportPDF(plan)}>
                        <Download className="w-4 h-4" />
                        Export PDF
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleExportWord(plan)}>
                        <Download className="w-4 h-4" />
                        Export Word
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handlePrint(plan)}>
                        <Printer className="w-4 h-4" />
                        Print
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDelete(plan)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>

                    {/* Drills List */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Drills:</h4>
                      {plan.drills.map((item, index) => (
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
                      ))}
                    </div>

                    {/* Equipment and Notes */}
                    {plan.equipment && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipment:</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{plan.equipment}</p>
                      </div>
                    )}
                    {plan.notes && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes:</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{plan.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No practice plans yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
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
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Coach</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedPlan.coach}</p>
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

            {/* Drills */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Practice Drills ({selectedPlan.drills.length})
              </h3>
              <div className="space-y-3">
                {selectedPlan.drills.map((item, index) => (
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
                ))}
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
