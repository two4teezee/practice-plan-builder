'use client';

import { useState, useEffect } from 'react';
import { 
  EQUIPMENT_OPTIONS, 
  EquipmentSelection, 
  equipmentSelectionsToString,
  parseEquipmentString 
} from '@/lib/types';
import { Plus, Minus, X } from 'lucide-react';

interface EquipmentPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function EquipmentPicker({ value, onChange, label }: EquipmentPickerProps) {
  const [selections, setSelections] = useState<Map<string, number>>(new Map());

  // Initialize from value string
  useEffect(() => {
    const parsed = parseEquipmentString(value);
    const newMap = new Map<string, number>();
    for (const s of parsed) {
      newMap.set(s.item, s.quantity);
    }
    setSelections(newMap);
  }, [value]);

  const updateSelection = (item: string, delta: number) => {
    const newSelections = new Map(selections);
    const current = newSelections.get(item) || 0;
    const newValue = Math.max(0, current + delta);
    
    if (newValue === 0) {
      newSelections.delete(item);
    } else {
      newSelections.set(item, newValue);
    }
    
    setSelections(newSelections);
    
    // Convert to string and call onChange
    const selectionsArray: EquipmentSelection[] = Array.from(newSelections.entries())
      .map(([item, quantity]) => ({ item: item as EquipmentSelection['item'], quantity }));
    onChange(equipmentSelectionsToString(selectionsArray));
  };

  const clearItem = (item: string) => {
    const newSelections = new Map(selections);
    newSelections.delete(item);
    setSelections(newSelections);
    
    const selectionsArray: EquipmentSelection[] = Array.from(newSelections.entries())
      .map(([item, quantity]) => ({ item: item as EquipmentSelection['item'], quantity }));
    onChange(equipmentSelectionsToString(selectionsArray));
  };

  const getQuantity = (item: string) => selections.get(item) || 0;

  return (
    <div className="w-full">
      {label && (
        <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </div>
      )}
      
      <div className="flex flex-wrap gap-2">
        {EQUIPMENT_OPTIONS.map((item) => {
          const quantity = getQuantity(item);
          const isSelected = quantity > 0;
          
          return (
            <div
              key={item}
              className={`
                inline-flex items-center gap-1 rounded-full border transition-all duration-200
                ${isSelected 
                  ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700' 
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              {/* Decrease button */}
              <button
                type="button"
                onClick={() => updateSelection(item, -1)}
                disabled={quantity === 0}
                className={`
                  p-1.5 rounded-full transition-colors
                  ${quantity > 0 
                    ? 'text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50' 
                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }
                `}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* Label and quantity */}
              <span className={`
                text-sm font-medium px-1 min-w-[80px] text-center
                ${isSelected 
                  ? 'text-primary-700 dark:text-primary-300' 
                  : 'text-gray-600 dark:text-gray-400'
                }
              `}>
                {item}
                {quantity > 0 && (
                  <span className="ml-1 text-xs font-bold bg-primary-200 dark:bg-primary-800 text-primary-800 dark:text-primary-200 rounded-full px-1.5 py-0.5">
                    {quantity}
                  </span>
                )}
              </span>

              {/* Increase button */}
              <button
                type="button"
                onClick={() => updateSelection(item, 1)}
                className="p-1.5 rounded-full text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Clear button (only when selected) */}
              {isSelected && (
                <button
                  type="button"
                  onClick={() => clearItem(item)}
                  className="p-1 mr-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {selections.size > 0 && (
        <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Selected: </span>
            {equipmentSelectionsToString(
              Array.from(selections.entries()).map(([item, quantity]) => ({ 
                item: item as EquipmentSelection['item'], 
                quantity 
              }))
            )}
          </p>
        </div>
      )}
    </div>
  );
}
