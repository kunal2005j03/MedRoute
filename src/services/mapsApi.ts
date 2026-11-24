import type { AccommodationOption } from '../types/medroute';
import { mapGooglePriceLevelToEstimate } from '../utils/costCalculator';

export interface AutocompleteSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export interface LiveProviderRaw {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  facilityType: string;
  types: string[];
  phone: string | null;
  website: string | null;
  googleMapsUri: string | null;
  straightLineKm: number;
  routeDistanceKm: number | null;
  routeDurationMinutes: number | null;
  routeSource: 'routes-api' | 'straight-line';
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  let payload: Record<string, unknown> | null = null;
  if (contentType.includes('application/json')) {
    payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  } else {
    const text = await response.text().catch(() => '');
    try {
      payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      payload = null;
    }
  }

  const errorObj = payload?.error as { status?: string; message?: string } | string | undefined;

  // Tier 2 Demo Key quota handling: surface quota-reached banner without crashing
  if (
    response.status === 429 ||
    payload?.quotaExceeded === true ||
    (typeof errorObj === 'object' && errorObj?.status === 'RESOURCE_EXHAUSTED')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    throw new Error(
      typeof errorObj === 'string'
        ? errorObj
        : 'Google Maps Platform daily quota reached. Please try again later or switch to Demo Mode.'
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof errorObj === 'string'
        ? errorObj
        : `Maps service request failed (${response.status}).`
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Maps service returned an unexpected response format. Please retry.');
  }

  return payload as T;
}

function assertValidLocationPayload(
  data: { label?: unknown; lat?: unknown; lng?: unknown; placeId?: unknown },
  fallbackError: string
): { label: string; lat: number; lng: number; placeId?: string } {
  const lat = Number(data?.lat);
  const lng = Number(data?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(fallbackError);
  }
  const label =
    typeof data?.label === 'string' && data.label.trim().length > 0
      ? data.label.trim()
      : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const placeId = typeof data?.placeId === 'string' && data.placeId.trim() ? data.placeId : undefined;
  return { label, lat, lng, placeId };
}

export async function checkMapsHealth(): Promise<{ status: string; mapsConfigured: boolean }> {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      return { status: 'error', mapsConfigured: false };
    }
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      return { status: 'error', mapsConfigured: false };
    }
    return {
      status: typeof data.status === 'string' ? data.status : 'ok',
      mapsConfigured: Boolean(data.mapsConfigured),
    };
  } catch {
    return { status: 'error', mapsConfigured: false };
  }
}

export async function fetchLocationSuggestions(
  input: string,
  sessionToken: string
): Promise<AutocompleteSuggestion[]> {
  const data = await postJson<{ suggestions?: AutocompleteSuggestion[] }>('/api/maps/autocomplete', {
    input,
    sessionToken,
  });
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

export async function resolvePlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<{ placeId: string; label: string; lat: number; lng: number }> {
  const data = await postJson<{ placeId?: unknown; label?: unknown; lat?: unknown; lng?: unknown }>(
    '/api/maps/place-details',
    { placeId, sessionToken }
  );
  const validated = assertValidLocationPayload(
    data,
    'Unable to resolve valid coordinates for the selected place.'
  );
  return {
    placeId: validated.placeId || placeId,
    label: validated.label,
    lat: validated.lat,
    lng: validated.lng,
  };
}

export async function geocodeManualAddress(
  address: string
): Promise<{ label: string; lat: number; lng: number; placeId?: string }> {
  const data = await postJson<{ label?: unknown; lat?: unknown; lng?: unknown; placeId?: unknown }>(
    '/api/maps/geocode',
    { address }
  );
  return assertValidLocationPayload(
    data,
    'Geocoding did not return valid coordinates for that address.'
  );
}

export async function reverseGeocodeCoords(
  lat: number,
  lng: number
): Promise<{ label: string; lat: number; lng: number; placeId?: string }> {
  const data = await postJson<{ label?: unknown; lat?: unknown; lng?: unknown; placeId?: unknown }>(
    '/api/maps/geocode',
    { lat, lng }
  );
  return assertValidLocationPayload(
    data,
    'Reverse geocoding did not return valid coordinates.'
  );
}

export async function searchLiveProviders(params: {
  originLat: number;
  originLng: number;
  searchQuery: string;
  radiusMeters?: number;
}): Promise<LiveProviderRaw[]> {
  const data = await postJson<{ providers?: LiveProviderRaw[] }>('/api/maps/providers', params);
  if (!Array.isArray(data.providers)) return [];
  return data.providers.filter(
    (p) =>
      p &&
      typeof p.placeId === 'string' &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      Number.isFinite(p.straightLineKm)
  );
}

export async function searchLiveAccommodations(
  hospitalLat: number,
  hospitalLng: number
): Promise<AccommodationOption[]> {
  const data = await postJson<{
    accommodations?: Array<{
      id: string;
      name: string;
      propertyType: string;
      address: string;
      lat: number;
      lng: number;
      distanceFromHospitalKm: number;
      priceLevel: string | null;
      googleMapsUri: string | null;
    }>;
  }>('/api/maps/accommodations', { hospitalLat, hospitalLng });

  const list = Array.isArray(data.accommodations) ? data.accommodations : [];
  return list
    .filter(
      (stay) =>
        stay &&
        typeof stay.id === 'string' &&
        Number.isFinite(stay.lat) &&
        Number.isFinite(stay.lng) &&
        Number.isFinite(stay.distanceFromHospitalKm)
    )
    .map((stay) => {
      const mapped = mapGooglePriceLevelToEstimate(stay.priceLevel);
      return {
        id: stay.id,
        name: stay.name,
        propertyType: stay.propertyType,
        address: stay.address,
        lat: stay.lat,
        lng: stay.lng,
        distanceFromHospitalKm: stay.distanceFromHospitalKm,
        nightlyRateInr: mapped.nightlyRateInr,
        nightlyRateRangeLabel: mapped.rangeLabel,
        priceSource: mapped.priceSource,
        googleMapsUri: stay.googleMapsUri,
        availabilityNotice:
          'Live hotel room availability is not verified by Google Places. Confirm directly with the property.',
      };
    });
}
