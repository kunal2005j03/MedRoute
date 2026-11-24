export type DataMode = 'demo' | 'live';

export type HealthcareCategory = 'Consultation' | 'Diagnostics' | 'Treatment';

export type ProvenanceLabel =
  | 'Demo Data'
  | 'Live API'
  | 'Curated Tariff (Firestore)'
  | 'Estimated'
  | 'Unavailable';

export interface MedicalService {
  id: string;
  name: string;
  category: HealthcareCategory;
  description: string;
  liveSearchKeyword: string;
}

export interface StartingLocation {
  label: string;
  lat: number;
  lng: number;
  source: 'gps' | 'manual' | 'preset';
  placeId?: string;
}

export interface AccommodationOption {
  id: string;
  name: string;
  propertyType: string;
  address: string;
  lat: number;
  lng: number;
  distanceFromHospitalKm: number;
  nightlyRateInr: number | null;
  nightlyRateRangeLabel?: string;
  priceSource: 'Demo Data' | 'Estimated from Price Tier' | 'User Entered' | 'Unavailable';
  googleMapsUri?: string | null;
  availabilityNotice: string;
}

export interface ProviderSearchResult {
  id: string;
  placeId?: string;
  name: string;
  facilityType: string;
  address: string;
  city?: string;
  lat: number;
  lng: number;
  phone?: string | null;
  website?: string | null;
  googleMapsUri?: string | null;
  // Travel metrics (always sorted strictly by proximity)
  distanceKm: number;
  durationMinutes: number | null;
  distanceSource: 'Demo Data (Estimated Road)' | 'Google Routes API (Live)' | 'Straight-line Distance';
  // Medical service charge (never defaults missing prices to 0)
  medicalChargeInr: number | null;
  medicalChargeLabel: string;
  medicalChargeSource: 'Demo Data' | 'Curated Tariff (Firestore)' | 'Unavailable';
  medicalChargeNote: string;
  serviceVerificationNote: string;
  // Optional accommodations (loaded only when user selects accommodationRequired = true)
  accommodations: AccommodationOption[];
  selectedAccommodationId: string | null;
  accommodationsLoaded: boolean;
  accommodationsLoading?: boolean;
  accommodationsError?: string | null;
}

export interface JourneyCostBreakdown {
  medicalChargeInr: number | null;
  primaryTravelEstimateInr: number;
  accommodationEstimateInr: number | null;
  localCommuteEstimateInr: number | null;
  knownSubtotalInr: number;
  totalEstimatedJourneyCostInr: number | null;
  isComplete: boolean;
  missingComponents: string[];
  travelFormulaNote: string;
  commuteFormulaNote: string | null;
}

export interface CuratedTariffRecord {
  id: string;
  providerName: string;
  googlePlaceId: string;
  city: string;
  state: string;
  facilityType: 'Hospital' | 'Clinic' | 'Diagnostic Centre' | 'Specialty Institute';
  category: HealthcareCategory;
  serviceId: string;
  serviceName: string;
  publishedChargeInr: number;
  chargeType: 'Published Tariff' | 'Official Package Rate' | 'Verified Schedule';
  sourceNote: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedComparisonRecord {
  id: string;
  ownerId: string;
  title: string;
  mode: DataMode;
  category: HealthcareCategory;
  serviceId: string;
  serviceName: string;
  originLabel: string;
  accommodationRequired: boolean;
  nights: number;
  providerCount: number;
  summaryLines: string[];
  createdAt?: unknown;
}

export interface SearchCriteria {
  category: HealthcareCategory;
  serviceId: string;
  origin: StartingLocation;
  accommodationRequired: boolean;
  nights: number;
}
