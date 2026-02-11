'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, X, Search, Loader2 } from 'lucide-react';
import type { Location } from '@/lib/types';
import type { PlacePrediction } from '@/app/api/places/autocomplete/route';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

interface LocationPickerProps {
  value: Location | null;
  onChange: (value: Location | null) => void;
  label?: string;
  placeholder?: string;
  compact?: boolean;
  style?: React.CSSProperties;
  helpText?: string;
}

export function LocationPicker({ 
  value, 
  onChange, 
  label, 
  placeholder = 'Search for a location...', 
  compact = false,
  style,
  helpText,
}: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for predictions
  const searchPlaces = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setPredictions([]);
      } else {
        setPredictions(data.predictions || []);
      }
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setError('Failed to search locations');
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsOpen(true);

    // Clear previous debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the search
    debounceRef.current = setTimeout(() => {
      searchPlaces(query);
    }, 300);
  };

  // Select a prediction and fetch full details
  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    setIsFetchingDetails(true);
    setIsOpen(false);
    setSearchQuery(prediction.mainText);

    try {
      // Pass the place name along with the placeId
      const params = new URLSearchParams({
        placeId: prediction.placeId,
        name: prediction.mainText,
      });
      const response = await fetch(`/api/places/details?${params}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (data.location) {
        onChange(data.location);
        setSearchQuery('');
      }
    } catch (err) {
      console.error('Error fetching place details:', err);
      setError('Failed to get location details');
    } finally {
      setIsFetchingDetails(false);
    }
  };

  // Clear the selected location
  const handleClear = () => {
    onChange(null);
    setSearchQuery('');
    setPredictions([]);
    inputRef.current?.focus();
  };

  const labelClasses = compact ? 'text-[11px]' : 'text-sm';
  const labelWrapperClasses = compact ? 'mb-1' : 'mb-1.5';
  const inputClasses = compact 
    ? 'px-2 py-1.5 text-[13px] rounded-lg'
    : 'px-3 py-2 rounded-lg';
  const inputId = 'location-picker-input';

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <div className={`flex items-center gap-1.5 ${labelWrapperClasses}`}>
          <label 
            htmlFor={inputId}
            className={`block font-medium text-gray-700 dark:text-gray-300 ${labelClasses}`}
          >
            {label}
          </label>
          <HelpTooltip
            text="Pick a location for the practice plan. Start typing in the name of the facility you will hold the practice at and a Google Places autocomplete suggestion will be provided. Practice plans can be filtered by location."
            iconClassName={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
          />
        </div>
      )}

      {/* Selected location display */}
      {value && (
        <div 
          className={`
            flex items-center gap-2 mb-2
            bg-primary-50 dark:bg-primary-900/20 
            border border-primary-200 dark:border-primary-800
            rounded-lg ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}
          `}
        >
          <MapPin className={`text-primary-600 dark:text-primary-400 flex-shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          <div className="flex-1 min-w-0">
            <div className={`text-primary-700 dark:text-primary-300 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {value.name}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full transition-colors flex-shrink-0"
            aria-label="Clear location"
          >
            <X className={`text-primary-600 dark:text-primary-400 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          </button>
        </div>
      )}

      {/* Search input */}
      {!value && (
        <div className="relative">
          <div
            className={`
              flex items-center gap-2 w-full border
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500
              ${inputClasses}
            `}
            style={style}
          >
            {isLoading || isFetchingDetails ? (
              <Loader2 className={`text-gray-400 animate-spin flex-shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
            ) : (
              <Search className={`text-gray-400 flex-shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
            )}
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => {
                if (searchQuery.length >= 2) {
                  setIsOpen(true);
                }
              }}
              placeholder={placeholder}
              className={`
                flex-1 bg-transparent outline-none
                text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                ${compact ? 'text-[13px]' : 'text-sm'}
              `}
              disabled={isFetchingDetails}
            />
          </div>

          {/* Dropdown list */}
          {isOpen && (predictions.length > 0 || error) && (
            <div 
              className={`
                absolute z-50 left-0 right-0 mt-1
                bg-white dark:bg-gray-800 
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-lg
                max-h-64 overflow-y-auto
              `}
            >
              {error ? (
                <div className={`${compact ? 'p-2 text-xs' : 'p-3 text-sm'} text-red-500 dark:text-red-400 text-center`}>
                  {error}
                </div>
              ) : (
                <ul className="py-1">
                  {predictions.map((prediction) => (
                    <li key={prediction.placeId}>
                      <button
                        type="button"
                        onClick={() => handleSelectPrediction(prediction)}
                        className={`
                          w-full flex items-start gap-2
                          ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}
                          hover:bg-gray-100 dark:hover:bg-gray-700
                          transition-colors text-left
                        `}
                      >
                        <MapPin className={`text-gray-400 flex-shrink-0 mt-0.5 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                        <div className="min-w-0 flex-1">
                          <div className={`text-gray-900 dark:text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                            {prediction.mainText}
                          </div>
                          {prediction.secondaryText && (
                            <div className={`text-gray-500 dark:text-gray-400 truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
                              {prediction.secondaryText}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* No results message */}
          {isOpen && searchQuery.length >= 2 && !isLoading && predictions.length === 0 && !error && (
            <div 
              className={`
                absolute z-50 left-0 right-0 mt-1
                bg-white dark:bg-gray-800 
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-lg
                ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}
                text-gray-500 dark:text-gray-400 text-center
              `}
            >
              No locations found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
