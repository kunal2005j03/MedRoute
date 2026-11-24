import type {
  AccommodationOption,
  JourneyCostBreakdown,
  StartingLocation,
} from '../types/medroute';

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Great-circle Haversine distance in kilometers between two coordinates.
 */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimates road distance & duration for Demo Mode using a 1.28 road-factor
 * and realistic urban vs highway average speeds.
 */
export function estimateRoadDistanceAndTime(
  origin: Coordinates,
  destination: Coordinates
): { distanceKm: number; durationMinutes: number } {
  const straightKm = haversineDistanceKm(origin, destination);
  const roadKm = Math.max(0.4, Math.round(straightKm * 1.28 * 10) / 10);
  const avgSpeedKmh = roadKm <= 25 ? 22 : roadKm <= 80 ? 38 : 52;
  const durationMinutes = Math.max(4, Math.round((roadKm / avgSpeedKmh) * 60));
  return { distanceKm: roadKm, durationMinutes };
}

/**
 * Transparent round-trip primary travel cost estimate (INR).
 * - Short urban trips (<= 40 km one-way): ₹50 base + ₹16/km (typical Indian city cab/auto benchmark), ×2 round-trip.
 * - Regional/intercity trips (> 40 km one-way): ₹12/km intercity cab/rail-transfer benchmark, ×2 round-trip.
 */
export function estimatePrimaryTravelCost(oneWayDistanceKm: number): {
  amountInr: number;
  formulaNote: string;
} {
  const safeKm = Number.isFinite(oneWayDistanceKm) ? Math.max(0, oneWayDistanceKm) : 0;
  if (safeKm <= 40) {
    const oneWay = Math.round(50 + safeKm * 16);
    const roundTrip = oneWay * 2;
    return {
      amountInr: roundTrip,
      formulaNote: `Estimated round-trip urban cab/auto (${safeKm.toFixed(1)} km × 2 at ₹16/km + ₹50 base each way).`,
    };
  }
  const oneWay = Math.round(safeKm * 12);
  const roundTrip = oneWay * 2;
  return {
    amountInr: roundTrip,
    formulaNote: `Estimated round-trip intercity transit (${safeKm.toFixed(1)} km × 2 at ₹12/km indicative rate).`,
  };
}

/**
 * Transparent local commute estimate between nearby accommodation and hospital
 * during the user's stay (round-trip per day × nights).
 */
export function estimateLocalCommuteCost(
  hotelToHospitalKm: number,
  nights: number
): { amountInr: number; formulaNote: string } {
  const safeNights = Number.isFinite(nights) ? Math.max(1, Math.round(nights)) : 1;
  const safeKm = Number.isFinite(hotelToHospitalKm) ? Math.max(0.2, hotelToHospitalKm) : 0.2;
  const dailyRoundTrip = Math.max(80, Math.round((35 + safeKm * 15) * 2));
  const total = dailyRoundTrip * safeNights;
  return {
    amountInr: total,
    formulaNote: `Estimated local hospital commute (${safeKm.toFixed(1)} km × 2/day × ${safeNights} ${
      safeNights === 1 ? 'day' : 'days'
    }).`,
  };
}

/**
 * Maps Google Places `priceLevel` to a clearly labeled indicative nightly rate
 * for Indian cities. Returns null when no price level is provided by Google Places
 * (never defaults missing pricing to ₹0).
 */
export function mapGooglePriceLevelToEstimate(priceLevel?: string | null): {
  nightlyRateInr: number | null;
  rangeLabel: string;
  priceSource: 'Estimated from Price Tier' | 'Unavailable';
} {
  switch (priceLevel) {
    case 'PRICE_LEVEL_INEXPENSIVE':
      return {
        nightlyRateInr: 1500,
        rangeLabel: '₹1,000 – ₹2,000 / night (indicative tier)',
        priceSource: 'Estimated from Price Tier',
      };
    case 'PRICE_LEVEL_MODERATE':
      return {
        nightlyRateInr: 3200,
        rangeLabel: '₹2,200 – ₹4,200 / night (indicative tier)',
        priceSource: 'Estimated from Price Tier',
      };
    case 'PRICE_LEVEL_EXPENSIVE':
      return {
        nightlyRateInr: 6500,
        rangeLabel: '₹5,000 – ₹8,000 / night (indicative tier)',
        priceSource: 'Estimated from Price Tier',
      };
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return {
        nightlyRateInr: 12000,
        rangeLabel: '₹9,500+ / night (indicative tier)',
        priceSource: 'Estimated from Price Tier',
      };
    default:
      return {
        nightlyRateInr: null,
        rangeLabel: 'Nightly tariff unavailable from live API',
        priceSource: 'Unavailable',
      };
  }
}

/**
 * Calculates overall estimated medical journey cost transparently.
 * CRITICAL RULE: Missing prices are NEVER treated as ₹0. If any required
 * component is missing, `isComplete` is false and `totalEstimatedJourneyCostInr` is null.
 */
export function calculateJourneyCost(params: {
  medicalChargeInr: number | null;
  distanceKm: number;
  accommodationRequired: boolean;
  nights: number;
  selectedAccommodation: AccommodationOption | null;
}): JourneyCostBreakdown {
  const {
    medicalChargeInr,
    distanceKm,
    accommodationRequired,
    nights,
    selectedAccommodation,
  } = params;

  const missingComponents: string[] = [];
  const primaryTravel = estimatePrimaryTravelCost(distanceKm);

  if (medicalChargeInr === null) {
    missingComponents.push('Medical service charge');
  }

  let accommodationEstimateInr: number | null = null;
  let localCommuteEstimateInr: number | null = null;
  let commuteFormulaNote: string | null = null;

  if (accommodationRequired) {
    const safeNights = Math.max(1, Math.round(nights));
    if (!selectedAccommodation) {
      missingComponents.push('Nearby accommodation selection');
    } else {
      const commute = estimateLocalCommuteCost(
        selectedAccommodation.distanceFromHospitalKm,
        safeNights
      );
      localCommuteEstimateInr = commute.amountInr;
      commuteFormulaNote = commute.formulaNote;

      if (selectedAccommodation.nightlyRateInr === null) {
        missingComponents.push(`Accommodation nightly tariff (${safeNights} nights)`);
      } else {
        accommodationEstimateInr = Math.round(selectedAccommodation.nightlyRateInr * safeNights);
      }
    }
  }

  const knownSubtotalInr =
    (medicalChargeInr ?? 0) +
    primaryTravel.amountInr +
    (accommodationEstimateInr ?? 0) +
    (localCommuteEstimateInr ?? 0);

  const isComplete = missingComponents.length === 0;
  const totalEstimatedJourneyCostInr = isComplete ? knownSubtotalInr : null;

  return {
    medicalChargeInr,
    primaryTravelEstimateInr: primaryTravel.amountInr,
    accommodationEstimateInr,
    localCommuteEstimateInr,
    knownSubtotalInr,
    totalEstimatedJourneyCostInr,
    isComplete,
    missingComponents,
    travelFormulaNote: primaryTravel.formulaNote,
    commuteFormulaNote,
  };
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Time unavailable';
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
}

/**
 * Generates a standard Google Maps default navigation URL.
 */
export function buildGoogleMapsDirectionsUrl(
  origin: StartingLocation,
  destination: { lat: number; lng: number; name?: string; placeId?: string }
): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  if (destination.placeId) {
    url.searchParams.set('destination_place_id', destination.placeId);
  }
  url.searchParams.set('travelmode', 'driving');
  return url.toString();
}
