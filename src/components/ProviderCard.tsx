import { useState } from 'react';
import { ExternalLink, Building2, Check, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  AccommodationOption,
  DataMode,
  ProviderSearchResult,
  StartingLocation,
} from '../types/medroute';
import {
  buildGoogleMapsDirectionsUrl,
  calculateJourneyCost,
  formatDuration,
  formatInr,
} from '../utils/costCalculator';

interface ProviderCardProps {
  rank: number;
  mode: DataMode;
  provider: ProviderSearchResult;
  origin: StartingLocation;
  accommodationRequired: boolean;
  nights: number;
  isCompared: boolean;
  compareLimitReached: boolean;
  onToggleCompare: (providerId: string) => void;
  onSelectAccommodation: (providerId: string, accommodationId: string) => void;
  onLoadLiveAccommodations: (providerId: string) => void;
  onCustomAccommodationRate: (providerId: string, accommodationId: string, rateInr: number | null) => void;
  onFocusOnMap: (providerId: string) => void;
}

export function ProviderCard({
  rank,
  mode,
  provider,
  origin,
  accommodationRequired,
  nights,
  isCompared,
  compareLimitReached,
  onToggleCompare,
  onSelectAccommodation,
  onLoadLiveAccommodations,
  onCustomAccommodationRate,
  onFocusOnMap,
}: ProviderCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [customRateDraft, setCustomRateDraft] = useState('');

  const selectedAccommodation: AccommodationOption | null = accommodationRequired
    ? provider.accommodations.find((a) => a.id === provider.selectedAccommodationId) ??
      provider.accommodations[0] ??
      null
    : null;

  const breakdown = calculateJourneyCost({
    medicalChargeInr: provider.medicalChargeInr,
    distanceKm: provider.distanceKm,
    accommodationRequired,
    nights,
    selectedAccommodation,
  });

  const directionsUrl = buildGoogleMapsDirectionsUrl(origin, {
    lat: provider.lat,
    lng: provider.lng,
    name: provider.name,
    placeId: provider.placeId,
  });

  return (
    <article className="bg-white border border-slate-200 rounded-lg p-5 transition-colors hover:border-slate-300">
      {/* Top row: Proximity rank & unboxed metadata (zero-pill discipline) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span className="font-semibold text-[#0F2A44] font-mono tabular-nums">
              #{rank} Nearest
            </span>
            <span aria-hidden="true">·</span>
            <span>{provider.facilityType}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700 font-medium">
              {Number.isFinite(provider.distanceKm)
                ? `${provider.distanceKm.toFixed(1)} km`
                : 'Distance unavailable'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {formatDuration(provider.durationMinutes)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{provider.distanceSource}</span>
          </div>

          <h3 className="mt-1.5 text-lg font-semibold text-slate-900 leading-snug">
            <button
              type="button"
              onClick={() => onFocusOnMap(provider.id)}
              className="text-left hover:text-[#0F766E] transition-colors cursor-pointer"
            >
              {provider.name}
            </button>
          </h3>

          <p className="mt-1 text-sm text-slate-600">{provider.address}</p>

          {(provider.phone || provider.website) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              {provider.phone && (
                <span className="font-mono tabular-nums">Phone: {provider.phone}</span>
              )}
              {provider.phone && provider.website && <span aria-hidden="true">·</span>}
              {provider.website && (
                <a
                  href={provider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F766E] hover:underline"
                >
                  Official Website
                </a>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col items-stretch sm:items-end gap-2 shrink-0">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2A44] rounded-md hover:bg-[#173a5c] transition-colors whitespace-nowrap"
          >
            Navigate in Google Maps
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={() => onToggleCompare(provider.id)}
            disabled={!isCompared && compareLimitReached}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isCompared
                ? 'bg-teal-50 text-[#0F766E] border-teal-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {isCompared ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Selected for Compare
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Add to Compare
              </>
            )}
          </button>
        </div>
      </div>

      {/* Transparent Cost Summary Strip (hairline divider, no nested cards) */}
      <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Medical Service Charge */}
        <div>
          <div className="text-xs text-slate-500">Medical Charge</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
            {provider.medicalChargeInr !== null ? formatInr(provider.medicalChargeInr) : 'Unavailable'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">{provider.medicalChargeSource}</div>
        </div>

        {/* 2. Primary Travel Estimate */}
        <div>
          <div className="text-xs text-slate-500">Est. Round-Trip Travel</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
            {formatInr(breakdown.primaryTravelEstimateInr)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Estimated travel expense</div>
        </div>

        {/* 3. Accommodation & Local Commute (shown only if requested) */}
        {accommodationRequired ? (
          <div>
            <div className="text-xs text-slate-500">
              Est. Stay ({nights} {nights === 1 ? 'night' : 'nights'}) + Commute
            </div>
            <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
              {breakdown.accommodationEstimateInr !== null &&
              breakdown.localCommuteEstimateInr !== null
                ? formatInr(breakdown.accommodationEstimateInr + breakdown.localCommuteEstimateInr)
                : 'Incomplete'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {selectedAccommodation
                ? selectedAccommodation.priceSource
                : 'Select or load nearby stay'}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-slate-500">Accommodation</div>
            <div className="mt-1 text-sm font-medium text-slate-700">Not requested</div>
            <div className="mt-0.5 text-[11px] text-slate-500">Same-day visit</div>
          </div>
        )}

        {/* 4. Overall Estimated Medical Journey Cost */}
        <div>
          <div className="text-xs text-slate-500">Overall Estimated Journey</div>
          {breakdown.isComplete && breakdown.totalEstimatedJourneyCostInr !== null ? (
            <>
              <div className="mt-1 text-base font-bold font-mono tabular-nums text-[#0F2A44]">
                {formatInr(breakdown.totalEstimatedJourneyCostInr)}
              </div>
              <div className="mt-0.5 text-[11px] text-[#0F766E]">
                Indicative total · not guaranteed
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-base font-bold text-amber-800">Incomplete Estimate</div>
              <div className="mt-0.5 text-[11px] text-amber-800 font-mono tabular-nums">
                Known subtotal: {formatInr(breakdown.knownSubtotalInr)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Incomplete warning explanation */}
      {!breakdown.isComplete && (
        <div className="mt-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <strong className="font-semibold">Missing essential cost data:</strong>{' '}
          {breakdown.missingComponents.join(', ')}. Missing prices are never counted as ₹0.
        </div>
      )}

      {/* Nearby Accommodation Section — ONLY rendered when user selected Accommodation Required = Yes */}
      {accommodationRequired && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F2A44]">
              <Building2 className="w-3.5 h-3.5 text-[#0F766E]" />
              Nearby Accommodation ({nights} {nights === 1 ? 'night' : 'nights'})
            </div>

            {mode === 'live' && !provider.accommodationsLoaded && (
              <button
                type="button"
                onClick={() => onLoadLiveAccommodations(provider.id)}
                disabled={provider.accommodationsLoading}
                className="text-xs font-semibold text-[#0F766E] hover:text-teal-800 underline cursor-pointer disabled:opacity-50"
              >
                {provider.accommodationsLoading
                  ? 'Searching Nearby Stays...'
                  : 'Discover Nearby Stays (Live Google Places)'}
              </button>
            )}
          </div>

          {provider.accommodationsError && (
            <p className="mt-2 text-xs text-red-700">{provider.accommodationsError}</p>
          )}

          {provider.accommodationsLoaded && provider.accommodations.length === 0 && (
            <p className="mt-2 text-xs text-slate-600">
              No nearby hotels or guest houses were returned within 4 km of this facility.
            </p>
          )}

          {provider.accommodations.length > 0 && (
            <div className="mt-3 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label
                  htmlFor={`stay-select-${provider.id}`}
                  className="text-xs text-slate-600 shrink-0"
                >
                  Select nearby stay:
                </label>
                  <select
                  id={`stay-select-${provider.id}`}
                  value={selectedAccommodation?.id ?? ''}
                  onChange={(e) => {
                    setCustomRateDraft('');
                    onSelectAccommodation(provider.id, e.target.value);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  {provider.accommodations.map((stay) => (
                    <option key={stay.id} value={stay.id}>
                      {stay.name} (
                      {Number.isFinite(stay.distanceFromHospitalKm)
                        ? `${stay.distanceFromHospitalKm.toFixed(1)} km from facility`
                        : 'Nearby'}{' '}
                      ·{' '}
                      {stay.nightlyRateInr !== null
                        ? `${formatInr(stay.nightlyRateInr)}/night`
                        : 'Tariff unavailable'}
                      )
                    </option>
                  ))}
                </select>
              </div>

              {selectedAccommodation && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">
                      {selectedAccommodation.name} · {selectedAccommodation.propertyType}
                    </span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {Number.isFinite(selectedAccommodation.distanceFromHospitalKm)
                        ? `${selectedAccommodation.distanceFromHospitalKm.toFixed(1)} km from hospital`
                        : 'Distance unavailable'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Nightly rate:{' '}
                      <strong className="font-mono tabular-nums text-slate-900">
                        {selectedAccommodation.nightlyRateInr !== null
                          ? `${formatInr(selectedAccommodation.nightlyRateInr)} × ${nights} = ${formatInr(
                              selectedAccommodation.nightlyRateInr * nights
                            )}`
                          : 'Unavailable'}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Source: {selectedAccommodation.priceSource}</span>
                    {selectedAccommodation.googleMapsUri && (
                      <>
                        <span aria-hidden="true">·</span>
                        <a
                          href={selectedAccommodation.googleMapsUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0F766E] underline"
                        >
                          View on Google Maps
                        </a>
                      </>
                    )}
                  </div>

                  {selectedAccommodation.nightlyRateRangeLabel && (
                    <div className="text-[11px] text-slate-500">
                      {selectedAccommodation.nightlyRateRangeLabel}
                    </div>
                  )}

                  {/* Honest optional manual nightly rate entry when live API tariff is unavailable */}
                  {mode === 'live' && (
                    <div className="pt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-600">
                        Know the exact room tariff? Enter ₹/night:
                      </span>
                      <input
                        type="number"
                        min={200}
                        max={100000}
                        placeholder="e.g. 1800"
                        value={customRateDraft}
                        onChange={(e) => setCustomRateDraft(e.target.value)}
                        className="w-24 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = Number(customRateDraft);
                          if (Number.isFinite(parsed) && parsed > 0) {
                            onCustomAccommodationRate(
                              provider.id,
                              selectedAccommodation.id,
                              Math.round(parsed)
                            );
                            setCustomRateDraft('');
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-[#0F2A44] bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        Apply Rate
                      </button>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500">
                    {selectedAccommodation.availabilityNotice}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expandable Transparency & Formula Breakdown */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          {showDetails ? (
            <>
              Hide Cost Assumptions &amp; Source Notes
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              View Cost Assumptions &amp; Source Notes
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>

        {provider.placeId && (
          <span className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]">
            Place ID: {provider.placeId}
          </span>
        )}
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
          <div>
            <strong className="text-slate-800">Medical charge note:</strong>{' '}
            {provider.medicalChargeNote}
          </div>
          <div>
            <strong className="text-slate-800">Service availability:</strong>{' '}
            {provider.serviceVerificationNote}
          </div>
          <div>
            <strong className="text-slate-800">Travel calculation:</strong>{' '}
            {breakdown.travelFormulaNote}
          </div>
          {breakdown.commuteFormulaNote && (
            <div>
              <strong className="text-slate-800">Local commute calculation:</strong>{' '}
              {breakdown.commuteFormulaNote}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
