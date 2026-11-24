import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import type { ProviderSearchResult, StartingLocation } from '../types/medroute';
import { buildGoogleMapsDirectionsUrl, formatDuration } from '../utils/costCalculator';

interface ProviderMapProps {
  origin: StartingLocation;
  providers: ProviderSearchResult[];
  selectedProviderId: string | null;
  mapsConfigured: boolean;
  onSelectProvider: (providerId: string | null) => void;
}

const MARKER_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

export function ProviderMap({
  origin,
  providers,
  selectedProviderId,
  mapsConfigured,
  onSelectProvider,
}: ProviderMapProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const selectedProvider =
    providers.find((p) => p.id === selectedProviderId) ?? null;

  const pinsQuery = useMemo(() => {
    return providers
      .slice(0, 15)
      .filter((provider) => Number.isFinite(provider.lat) && Number.isFinite(provider.lng))
      .map((provider, idx) => {
        const label = MARKER_LABELS[idx] ?? '';
        const isSelected = provider.id === selectedProviderId ? '1' : '0';
        return `${provider.lat.toFixed(6)},${provider.lng.toFixed(6)},${label},${isSelected}`;
      })
      .join(';');
  }, [providers, selectedProviderId]);

  useEffect(() => {
    if (!mapsConfigured || !Number.isFinite(origin?.lat) || !Number.isFinite(origin?.lng)) {
      setImageUrl(null);
      setMapError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const loadMapImage = async () => {
      setMapLoading(true);
      setMapError(null);

      try {
        const params = new URLSearchParams({
          originLat: String(origin.lat),
          originLng: String(origin.lng),
        });
        if (pinsQuery) {
          params.set('pins', pinsQuery);
        }

        const response = await fetch(`/api/maps/static-map?${params.toString()}`);

        if (response.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          throw new Error('Google Maps Platform quota reached for static map rendering.');
        }

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(
            typeof errBody?.error === 'string'
              ? errBody.error
              : 'Map preview unavailable. Verify that Maps Static API is enabled on GOOGLE_MAPS_API_KEY.'
          );
        }

        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setImageUrl(null);
          setMapError(
            err instanceof Error
              ? err.message
              : 'Unable to load server-proxied Google Map preview.'
          );
        }
      } finally {
        if (!cancelled) {
          setMapLoading(false);
        }
      }
    };

    void loadMapImage();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [origin.lat, origin.lng, pinsQuery, mapsConfigured]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span className="font-semibold text-[#0F2A44]">
          Proximity Map ({providers.length} displayed)
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Navy S: Starting location</span>
          <span aria-hidden="true">·</span>
          <span>Teal 1–{Math.min(providers.length, 9)}: Nearest providers</span>
          {selectedProvider && (
            <>
              <span aria-hidden="true">·</span>
              <span>Red: Selected provider</span>
            </>
          )}
        </div>
      </div>

      {/* Map Viewport (rendered exclusively through /api/maps/static-map backend proxy) */}
      <div className="relative w-full h-[320px] sm:h-[360px] bg-slate-100 flex items-center justify-center">
        {!mapsConfigured ? (
          <div className="max-w-md px-6 text-center">
            <MapPin className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="mt-2 text-sm font-medium text-slate-800">
              Server Google Maps API key not configured
            </p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Configure <code className="font-mono text-slate-800">GOOGLE_MAPS_API_KEY</code> on
              the server to display the proximity map. Direct Google Maps turn-by-turn navigation
              links remain available on every provider card.
            </p>
          </div>
        ) : mapError ? (
          <div className="max-w-lg px-6 text-center">
            <MapPin className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="mt-2 text-sm font-medium text-slate-800">
              Map preview could not be loaded
            </p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{mapError}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              Direct Google Maps navigation links below and on each provider card remain active.
            </p>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={`Proximity map showing starting location ${origin.label} and ${providers.length} nearest healthcare providers`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-xs text-slate-500">
            {mapLoading ? 'Loading proximity map from server...' : 'Preparing map preview...'}
          </div>
        )}

        {mapLoading && imageUrl && (
          <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/95 border border-slate-200 rounded text-[11px] text-slate-600">
            Updating map...
          </div>
        )}
      </div>

      {/* Interactive Pin Selection Strip & Selected Provider Bar */}
      {providers.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1">Highlight pin:</span>
            {providers.slice(0, 15).map((provider, idx) => {
              const label = MARKER_LABELS[idx] ?? String(idx + 1);
              const isSelected = provider.id === selectedProviderId;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => onSelectProvider(isSelected ? null : provider.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F2A44] text-white border-[#0F2A44]'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {label}. {provider.name.length > 26 ? `${provider.name.slice(0, 26)}…` : provider.name}
                </button>
              );
            })}
          </div>

          {selectedProvider && (
            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-[#0F2A44]">{selectedProvider.name}</span>
                <span className="text-slate-500">
                  {' '}
                  · {selectedProvider.facilityType} ·{' '}
                  <span className="font-mono tabular-nums text-slate-700">
                    {Number.isFinite(selectedProvider.distanceKm)
                      ? `${selectedProvider.distanceKm.toFixed(1)} km`
                      : 'Distance unavailable'}
                  </span>{' '}
                  · {formatDuration(selectedProvider.durationMinutes)}
                </span>
              </div>
              <a
                href={buildGoogleMapsDirectionsUrl(origin, {
                  lat: selectedProvider.lat,
                  lng: selectedProvider.lng,
                  name: selectedProvider.name,
                  placeId: selectedProvider.placeId,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#0F766E] hover:underline whitespace-nowrap shrink-0"
              >
                Open Google Maps Navigation
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
