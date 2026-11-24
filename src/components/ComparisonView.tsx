import { useState } from 'react';
import type { User } from 'firebase/auth';
import { ExternalLink, BookmarkCheck, Trash2 } from 'lucide-react';
import { saveJourneyComparison } from '../services/firestoreService';
import type {
  DataMode,
  MedicalService,
  ProviderSearchResult,
  StartingLocation,
} from '../types/medroute';
import {
  buildGoogleMapsDirectionsUrl,
  calculateJourneyCost,
  formatDuration,
  formatInr,
} from '../utils/costCalculator';

interface ComparisonViewProps {
  mode: DataMode;
  service: MedicalService | null;
  origin: StartingLocation;
  accommodationRequired: boolean;
  nights: number;
  comparedProviders: ProviderSearchResult[];
  user: User | null;
  onRemoveProvider: (providerId: string) => void;
  onClearAll: () => void;
  onBackToPlanner: () => void;
  onSignIn: () => void;
  onComparisonSaved: () => void;
}

export function ComparisonView({
  mode,
  service,
  origin,
  accommodationRequired,
  nights,
  comparedProviders,
  user,
  onRemoveProvider,
  onClearAll,
  onBackToPlanner,
  onSignIn,
  onComparisonSaved,
}: ComparisonViewProps) {
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (comparedProviders.length === 0) {
    return (
      <section className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <h2 className="text-lg font-semibold text-[#0F2A44]">No Providers Selected for Comparison</h2>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Select 2 to 4 providers from the Route Planner results to compare proximity, travel time,
          published or demo medical charges, optional stay expenses, and overall estimated journey
          costs side by side.
        </p>
        <button
          type="button"
          onClick={onBackToPlanner}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-[#0F2A44] rounded-md hover:bg-[#173a5c] transition-colors cursor-pointer"
        >
          Return to Route Planner
        </button>
      </section>
    );
  }

  const enriched = comparedProviders.map((provider) => {
    const selectedAccommodation = accommodationRequired
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
    return { provider, selectedAccommodation, breakdown };
  });

  const handleSaveComparison = async () => {
    if (!service) return;
    setSaveError(null);
    setSaveMessage(null);
    setSaving(true);

    try {
      const summaryLines = enriched.slice(0, 4).map(({ provider, breakdown }) => {
        const totalText =
          breakdown.isComplete && breakdown.totalEstimatedJourneyCostInr !== null
            ? formatInr(breakdown.totalEstimatedJourneyCostInr)
            : `Incomplete (Known: ${formatInr(breakdown.knownSubtotalInr)})`;
        const distText = Number.isFinite(provider.distanceKm)
          ? `${provider.distanceKm.toFixed(1)} km`
          : 'Distance unavailable';
        return `${provider.name} (${distText}) — ${totalText}`;
      });

      await saveJourneyComparison({
        title: `${service.name} (${comparedProviders.length} providers)`,
        mode,
        category: service.category,
        serviceId: service.id,
        serviceName: service.name,
        originLabel: origin.label,
        accommodationRequired,
        nights: accommodationRequired ? nights : 0,
        providerCount: comparedProviders.length,
        summaryLines,
      });

      setSaveMessage('Comparison saved to your Firestore account under Saved Plans.');
      onComparisonSaved();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Unable to save comparison to Firestore.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F2A44]">Side-by-Side Journey Cost Comparison</h2>
          <p className="mt-1 text-xs text-slate-600">
            {service ? `${service.category} · ${service.name}` : 'Selected Medical Service'} · From{' '}
            {origin.label} · {accommodationRequired ? `${nights} night(s) stay included` : 'No accommodation'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {comparedProviders.length >= 2 &&
            (user ? (
              <button
                type="button"
                onClick={handleSaveComparison}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F766E] rounded-md hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Comparison'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2A44] rounded-md hover:bg-[#173a5c] transition-colors cursor-pointer"
              >
                Sign In to Save
              </button>
            ))}

          <button
            type="button"
            onClick={onClearAll}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Clear All
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="text-xs text-[#0F766E] bg-teal-50 border border-teal-200 rounded-md px-4 py-2.5">
          {saveMessage}
        </div>
      )}
      {saveError && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-md px-4 py-2.5">
          {saveError}
        </div>
      )}

      {comparedProviders.length === 1 && (
        <div className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-4 py-2.5">
          Add at least one more provider from the Route Planner to compare side by side or save this
          comparison.
        </div>
      )}

      {/* Strictly factual comparison matrix — no automatic "Best Hospital" winner badge */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="py-3.5 px-4 text-xs font-semibold text-slate-600 w-52">
                Journey Factor
              </th>
              {enriched.map(({ provider }) => (
                <th key={provider.id} className="py-3.5 px-4 align-top">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[#0F2A44]">{provider.name}</div>
                      <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                        {provider.facilityType}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveProvider(provider.id)}
                      aria-label={`Remove ${provider.name}`}
                      className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-sm">
            <tr>
              <td className="py-3 px-4 text-xs font-medium text-slate-600">Proximity &amp; Travel</td>
              {enriched.map(({ provider }) => (
                <td key={provider.id} className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {Number.isFinite(provider.distanceKm)
                    ? `${provider.distanceKm.toFixed(1)} km`
                    : 'Distance unavailable'}{' '}
                  · {formatDuration(provider.durationMinutes)}
                  <div className="font-sans text-[11px] text-slate-500 mt-0.5">
                    {provider.distanceSource}
                  </div>
                </td>
              ))}
            </tr>

            <tr>
              <td className="py-3 px-4 text-xs font-medium text-slate-600">
                Published / Demo Medical Charge
              </td>
              {enriched.map(({ provider }) => (
                <td key={provider.id} className="py-3 px-4">
                  <div className="font-mono tabular-nums font-medium text-slate-900">
                    {provider.medicalChargeInr !== null
                      ? formatInr(provider.medicalChargeInr)
                      : 'Unavailable'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {provider.medicalChargeSource}
                  </div>
                </td>
              ))}
            </tr>

            <tr>
              <td className="py-3 px-4 text-xs font-medium text-slate-600">
                Est. Primary Travel (Round-Trip)
              </td>
              {enriched.map(({ provider, breakdown }) => (
                <td key={provider.id} className="py-3 px-4">
                  <div className="font-mono tabular-nums text-slate-900">
                    {formatInr(breakdown.primaryTravelEstimateInr)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Estimated</div>
                </td>
              ))}
            </tr>

            {accommodationRequired && (
              <>
                <tr>
                  <td className="py-3 px-4 text-xs font-medium text-slate-600">
                    Est. Accommodation ({nights} {nights === 1 ? 'night' : 'nights'})
                  </td>
                  {enriched.map(({ provider, selectedAccommodation, breakdown }) => (
                    <td key={provider.id} className="py-3 px-4">
                      <div className="font-mono tabular-nums text-slate-900">
                        {breakdown.accommodationEstimateInr !== null
                          ? formatInr(breakdown.accommodationEstimateInr)
                          : 'Unavailable'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {selectedAccommodation
                          ? `${selectedAccommodation.name} (${selectedAccommodation.priceSource})`
                          : 'No stay loaded/selected'}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 px-4 text-xs font-medium text-slate-600">
                    Est. Local Hospital Commute
                  </td>
                  {enriched.map(({ provider, breakdown }) => (
                    <td key={provider.id} className="py-3 px-4 font-mono tabular-nums text-slate-900">
                      {breakdown.localCommuteEstimateInr !== null
                        ? formatInr(breakdown.localCommuteEstimateInr)
                        : 'Unavailable'}
                    </td>
                  ))}
                </tr>
              </>
            )}

            <tr className="bg-slate-50">
              <td className="py-4 px-4 text-xs font-semibold text-[#0F2A44]">
                Overall Estimated Journey Cost
              </td>
              {enriched.map(({ provider, breakdown }) => (
                <td key={provider.id} className="py-4 px-4">
                  {breakdown.isComplete && breakdown.totalEstimatedJourneyCostInr !== null ? (
                    <>
                      <div className="text-base font-bold font-mono tabular-nums text-[#0F2A44]">
                        {formatInr(breakdown.totalEstimatedJourneyCostInr)}
                      </div>
                      <div className="text-[11px] text-[#0F766E] mt-0.5">
                        Complete indicative estimate
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-amber-800">Incomplete Estimate</div>
                      <div className="text-[11px] text-amber-800 font-mono tabular-nums mt-0.5">
                        Known subtotal: {formatInr(breakdown.knownSubtotalInr)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Missing: {breakdown.missingComponents.join(', ')}
                      </div>
                    </>
                  )}
                </td>
              ))}
            </tr>

            <tr>
              <td className="py-3 px-4 text-xs font-medium text-slate-600">Navigation</td>
              {enriched.map(({ provider }) => (
                <td key={provider.id} className="py-3 px-4">
                  <a
                    href={buildGoogleMapsDirectionsUrl(origin, {
                      lat: provider.lat,
                      lng: provider.lng,
                      name: provider.name,
                      placeId: provider.placeId,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    Open Google Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        MedRoute does not automatically rank or select a &ldquo;best hospital.&rdquo; All journey
        estimates combine published/demo medical tariffs with indicative travel and accommodation
        assumptions and are not guaranteed final bills. Confirm medical eligibility, exact charges,
        and hotel availability directly with each provider.
      </p>
    </section>
  );
}
