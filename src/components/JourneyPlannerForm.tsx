import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Search, MapPin } from 'lucide-react';
import {
  getServicesByCategory,
  HEALTHCARE_CATEGORIES,
  PAN_INDIA_PRESET_LOCATIONS,
} from '../data/services';
import {
  fetchLocationSuggestions,
  geocodeManualAddress,
  resolvePlaceDetails,
  reverseGeocodeCoords,
  type AutocompleteSuggestion,
} from '../services/mapsApi';
import type {
  DataMode,
  HealthcareCategory,
  SearchCriteria,
  StartingLocation,
} from '../types/medroute';

interface JourneyPlannerFormProps {
  mode: DataMode;
  onModeChange: (mode: DataMode) => void;
  mapsConfigured: boolean;
  isSearching: boolean;
  initialCriteria: SearchCriteria;
  onSearch: (criteria: SearchCriteria) => void;
}

function hasValidCoords(loc: Partial<StartingLocation> | null | undefined): loc is StartingLocation {
  return Boolean(
    loc &&
      typeof loc.lat === 'number' &&
      Number.isFinite(loc.lat) &&
      typeof loc.lng === 'number' &&
      Number.isFinite(loc.lng)
  );
}

export function JourneyPlannerForm({
  mode,
  onModeChange,
  mapsConfigured,
  isSearching,
  initialCriteria,
  onSearch,
}: JourneyPlannerFormProps) {
  const safeInitialOrigin = hasValidCoords(initialCriteria?.origin)
    ? initialCriteria.origin
    : PAN_INDIA_PRESET_LOCATIONS[0];

  const [category, setCategory] = useState<HealthcareCategory>(initialCriteria.category);
  const [serviceId, setServiceId] = useState<string>(initialCriteria.serviceId);
  const [origin, setOrigin] = useState<StartingLocation>(safeInitialOrigin);
  const [manualInput, setManualInput] = useState<string>(safeInitialOrigin.label);
  const [accommodationRequired, setAccommodationRequired] = useState<boolean>(
    initialCriteria.accommodationRequired
  );
  const [nights, setNights] = useState<number>(initialCriteria.nights || 2);

  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sessionTokenRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const availableServices = useMemo(() => getServicesByCategory(category), [category]);
  const selectedService = availableServices.find((s) => s.id === serviceId) ?? availableServices[0];

  useEffect(() => {
    if (!availableServices.some((s) => s.id === serviceId) && availableServices[0]) {
      setServiceId(availableServices[0].id);
    }
  }, [availableServices, serviceId]);

  // Debounced Google Places Autocomplete for Live Mode manual location entry
  useEffect(() => {
    if (mode !== 'live' || !mapsConfigured) {
      setSuggestions([]);
      return;
    }
    const query = manualInput.trim();
    if (query.length < 3 || query === origin.label) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const list = await fetchLocationSuggestions(query, sessionTokenRef.current);
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {
        // Non-blocking: user can still click Locate Address to geocode directly
        setSuggestions([]);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [manualInput, mode, mapsConfigured, origin.label]);

  const handleUseCurrentLocation = () => {
    setLocationError(null);
    setLocationMessage(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser. Enter your location manually.');
      return;
    }

    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 100000) / 100000;
        const lng = Math.round(pos.coords.longitude * 100000) / 100000;

        if (mode === 'live' && mapsConfigured) {
          try {
            const resolved = await reverseGeocodeCoords(lat, lng);
            const nextOrigin: StartingLocation = {
              label: resolved.label,
              lat: resolved.lat,
              lng: resolved.lng,
              placeId: resolved.placeId,
              source: 'gps',
            };
            setOrigin(nextOrigin);
            setManualInput(nextOrigin.label);
            setLocationMessage('Current GPS location verified via Google Geocoding.');
          } catch {
            const fallbackLabel = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            setOrigin({ label: fallbackLabel, lat, lng, source: 'gps' });
            setManualInput(fallbackLabel);
            setLocationMessage('Current GPS coordinates captured.');
          } finally {
            setLocationBusy(false);
          }
        } else {
          const label = `Current GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setOrigin({ label, lat, lng, source: 'gps' });
          setManualInput(label);
          setLocationMessage('Current GPS coordinates captured.');
          setLocationBusy(false);
        }
      },
      (err) => {
        setLocationBusy(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission was denied. Please enter your city or address manually.');
        } else {
          setLocationError('Unable to determine your current location. Please enter a location manually.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleSelectSuggestion = async (suggestion: AutocompleteSuggestion) => {
    setShowSuggestions(false);
    setLocationError(null);
    setLocationMessage(null);
    setLocationBusy(true);

    try {
      const details = await resolvePlaceDetails(suggestion.placeId, sessionTokenRef.current);
      // Reset session token after place details resolution per GMP billing best practice
      sessionTokenRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const nextOrigin: StartingLocation = {
        label: details.label,
        lat: details.lat,
        lng: details.lng,
        placeId: details.placeId,
        source: 'manual',
      };
      setOrigin(nextOrigin);
      setManualInput(nextOrigin.label);
      setLocationMessage('Starting location verified.');
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : 'Unable to resolve selected place.'
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const handleManualGeocode = async () => {
    const trimmed = manualInput.trim();
    setLocationError(null);
    setLocationMessage(null);
    setShowSuggestions(false);

    if (trimmed.length < 2) {
      setLocationError('Please enter a locality, city, or PIN code in India.');
      return;
    }

    // Check if user entered raw coordinates "lat, lng"
    const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) {
        setOrigin({ label: `Custom Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng, source: 'manual' });
        setLocationMessage('Coordinates set as starting location.');
        return;
      }
    }

    // Check preset match first in Demo Mode
    const presetMatch = PAN_INDIA_PRESET_LOCATIONS.find((loc) =>
      loc.label.toLowerCase().includes(trimmed.toLowerCase())
    );

    if (mode === 'demo' && presetMatch) {
      setOrigin(presetMatch);
      setManualInput(presetMatch.label);
      setLocationMessage(`Starting location set to ${presetMatch.label}.`);
      return;
    }

    if (mapsConfigured) {
      setLocationBusy(true);
      try {
        const geocoded = await geocodeManualAddress(trimmed);
        const nextOrigin: StartingLocation = {
          label: geocoded.label,
          lat: geocoded.lat,
          lng: geocoded.lng,
          placeId: geocoded.placeId,
          source: 'manual',
        };
        setOrigin(nextOrigin);
        setManualInput(nextOrigin.label);
        setLocationMessage('Starting location geocoded across India.');
      } catch (error) {
        if (presetMatch) {
          setOrigin(presetMatch);
          setManualInput(presetMatch.label);
          setLocationMessage(`Matched Indian city preset: ${presetMatch.label}.`);
        } else {
          setLocationError(
            error instanceof Error
              ? error.message
              : 'Could not find that address. Try a city name or select a preset below.'
          );
        }
      } finally {
        setLocationBusy(false);
      }
    } else if (presetMatch) {
      setOrigin(presetMatch);
      setManualInput(presetMatch.label);
      setLocationMessage(`Starting location set to ${presetMatch.label}.`);
    } else {
      setLocationError(
        'Select one of the Indian city presets below or enter coordinates (lat, lng).'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationError(null);

    if (accommodationRequired && (!Number.isFinite(nights) || nights < 1 || nights > 30)) {
      setLocationError('Please enter a valid number of nights between 1 and 30.');
      return;
    }

    // If user typed a new address without clicking Verify first, resolve it before searching
    let activeOrigin = hasValidCoords(origin) ? origin : PAN_INDIA_PRESET_LOCATIONS[0];
    const trimmedInput = manualInput.trim();
    if (trimmedInput && trimmedInput !== activeOrigin.label) {
      const coordMatch = trimmedInput.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
      const presetMatch = PAN_INDIA_PRESET_LOCATIONS.find((loc) =>
        loc.label.toLowerCase().includes(trimmedInput.toLowerCase())
      );

      if (coordMatch) {
        const lat = Number(coordMatch[1]);
        const lng = Number(coordMatch[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) {
          activeOrigin = {
            label: `Custom Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            lat,
            lng,
            source: 'manual',
          };
          setOrigin(activeOrigin);
          setManualInput(activeOrigin.label);
        }
      } else if (mode === 'demo' && presetMatch) {
        activeOrigin = presetMatch;
        setOrigin(presetMatch);
        setManualInput(presetMatch.label);
      } else if (mapsConfigured) {
        setLocationBusy(true);
        try {
          const geocoded = await geocodeManualAddress(trimmedInput);
          activeOrigin = {
            label: geocoded.label,
            lat: geocoded.lat,
            lng: geocoded.lng,
            placeId: geocoded.placeId,
            source: 'manual',
          };
          setOrigin(activeOrigin);
          setManualInput(activeOrigin.label);
        } catch (error) {
          if (presetMatch) {
            activeOrigin = presetMatch;
            setOrigin(presetMatch);
            setManualInput(presetMatch.label);
          } else {
            setLocationBusy(false);
            setLocationError(
              error instanceof Error
                ? error.message
                : 'Unable to locate the entered starting address.'
            );
            return;
          }
        } finally {
          setLocationBusy(false);
        }
      } else if (presetMatch) {
        activeOrigin = presetMatch;
        setOrigin(presetMatch);
        setManualInput(presetMatch.label);
      }
    }

    if (!selectedService) return;

    onSearch({
      category,
      serviceId: selectedService.id,
      origin: activeOrigin,
      accommodationRequired,
      nights: accommodationRequired ? Math.max(1, Math.min(30, Math.round(nights))) : 0,
    });
  };

  return (
    <section
      aria-label="Medical journey planner"
      className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6"
    >
      {/* Workspace Mode Toolbar (kept out of top header per layout discipline) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F2A44] tracking-tight">
            Plan Your Medical Journey
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Find suitable healthcare providers sorted strictly by proximity and estimate transparent
            journey expenses across India.
          </p>
        </div>

        <div className="shrink-0">
          <div
            role="group"
            aria-label="Data source mode"
            className="inline-flex items-center p-1 bg-slate-100 rounded-md border border-slate-200"
          >
            <button
              type="button"
              onClick={() => onModeChange('demo')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'demo'
                  ? 'bg-white text-[#0F2A44] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Demo Mode
            </button>
            <button
              type="button"
              onClick={() => onModeChange('live')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'live'
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Mode
            </button>
          </div>
        </div>
      </div>

      {/* Mode Transparency Notice */}
      <div className="mt-4 text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5">
        {mode === 'demo' ? (
          <span>
            <strong className="font-semibold text-slate-800">Demo Mode active:</strong> Uses an
            illustrative sample dataset (Kolkata pilot region) to test the full workflow. All sample
            providers and prices are labeled as <em>Demo Data</em> and are not real hospital quotes.
          </span>
        ) : (
          <span>
            <strong className="font-semibold text-slate-800">Live Mode active:</strong> Discovers
            real hospitals, clinics, travel times, and nearby stays anywhere in India via Google
            Maps Platform and cross-checks medical tariffs against verified Firebase Cloud Firestore
            records. Unavailable charges are honestly marked as incomplete.
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Step 1 & Step 2: Category and Medical Service */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              1. Healthcare Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {HEALTHCARE_CATEGORIES.map((cat) => {
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-2.5 text-sm font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                      selected
                        ? 'bg-[#0F2A44] text-white border-[#0F2A44]'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7">
            <label
              htmlFor="medroute-service"
              className="block text-xs font-semibold text-slate-700 mb-2"
            >
              2. Specific Medical Service
            </label>
            <select
              id="medroute-service"
              value={selectedService.id}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
            >
              {availableServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">{selectedService.description}</p>
          </div>
        </div>

        {/* Step 3: Starting Location */}
        <div className="pt-5 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <label
              htmlFor="medroute-origin"
              className="text-xs font-semibold text-slate-700"
            >
              3. Starting Location (Pan-India)
            </label>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locationBusy}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F766E] hover:text-teal-800 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              Use Current Location
            </button>
          </div>

          <div className="relative">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  id="medroute-origin"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                  placeholder="Enter any Indian locality, city, railway station, or PIN code..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
                />
              </div>
              <button
                type="button"
                onClick={handleManualGeocode}
                disabled={locationBusy}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {locationBusy ? 'Locating...' : 'Verify Location'}
              </button>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md max-h-60 overflow-y-auto divide-y divide-slate-100"
              >
                {suggestions.map((item) => (
                  <li key={item.placeId}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        void handleSelectSuggestion(item);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="text-sm font-medium text-slate-900">{item.mainText}</div>
                      {item.secondaryText && (
                        <div className="text-xs text-slate-500">{item.secondaryText}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-[#0F766E]" />
              Active start:
            </span>
            <span className="text-slate-800">{origin?.label || 'Not set'}</span>
            {hasValidCoords(origin) && (
              <span className="text-slate-400 font-mono tabular-nums">
                ({origin.lat.toFixed(4)}, {origin.lng.toFixed(4)})
              </span>
            )}
          </div>

          {/* Quick Indian City Presets */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-500">Quick cities:</span>
            {PAN_INDIA_PRESET_LOCATIONS.slice(0, 8).map((loc) => {
              const shortName = loc.label.split(',').slice(0, 2).join(',');
              return (
                <button
                  key={loc.label}
                  type="button"
                  onClick={() => {
                    setOrigin(loc);
                    setManualInput(loc.label);
                    setLocationError(null);
                    setLocationMessage(null);
                  }}
                  className="text-slate-600 hover:text-[#0F766E] underline decoration-slate-300 underline-offset-2 cursor-pointer"
                >
                  {shortName}
                </button>
              );
            })}
          </div>

          {locationMessage && (
            <p className="mt-2 text-xs text-[#0F766E]" role="status">
              {locationMessage}
            </p>
          )}
          {locationError && (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {locationError}
            </p>
          )}
        </div>

        {/* Step 4 & Conditional Step 5: Accommodation */}
        <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">
                4. Is Accommodation Required?
              </span>
              <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAccommodationRequired(false)}
                  className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    !accommodationRequired
                      ? 'bg-[#0F2A44] text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setAccommodationRequired(true)}
                  className={`px-4 py-2 text-sm font-medium border-l border-slate-300 transition-colors cursor-pointer ${
                    accommodationRequired
                      ? 'bg-[#0F2A44] text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>

            {accommodationRequired && (
              <div>
                <label
                  htmlFor="medroute-nights"
                  className="block text-xs font-semibold text-slate-700 mb-2"
                >
                  5. Required Number of Nights
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="medroute-nights"
                    type="number"
                    min={1}
                    max={30}
                    value={nights}
                    onChange={(e) => setNights(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                    className="w-24 px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
                  />
                  <span className="text-xs text-slate-500">
                    {nights === 1 ? 'night' : 'nights'} (multiplied by nightly stay estimate)
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSearching || locationBusy}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-md hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {isSearching ? 'Finding Nearest Providers...' : 'Find Nearest Providers'}
          </button>
        </div>
      </form>
    </section>
  );
}
