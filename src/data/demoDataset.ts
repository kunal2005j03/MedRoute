import type { AccommodationOption, ProviderSearchResult, StartingLocation } from '../types/medroute';
import { estimateRoadDistanceAndTime, haversineDistanceKm } from '../utils/costCalculator';

/**
 * ILLUSTRATIVE DEMO DATASET (Kolkata Pilot Region)
 * -------------------------------------------------
 * All records below are strictly fictional sample providers and illustrative
 * prices created solely for testing the MedRoute end-to-end workflow in Demo Mode.
 * - Never represent these records as real hospitals or official tariffs.
 * - Not every provider offers every medical service.
 * - Selected entries intentionally have `null` charges to verify honest
 *   "Incomplete Estimate" handling (missing prices are never treated as ₹0).
 */

interface DemoServiceOffering {
  chargeInr: number | null;
  note: string;
}

interface DemoStaySeed {
  id: string;
  name: string;
  propertyType: string;
  address: string;
  lat: number;
  lng: number;
  nightlyRateInr: number | null;
}

interface DemoProviderSeed {
  id: string;
  name: string;
  facilityType: 'Hospital' | 'Clinic' | 'Diagnostic Centre' | 'Specialty Institute';
  address: string;
  city: string;
  lat: number;
  lng: number;
  offeredServices: Record<string, DemoServiceOffering>;
  nearbyStays: DemoStaySeed[];
}

const DEMO_PROVIDERS: DemoProviderSeed[] = [
  {
    id: 'demo-kol-01',
    name: 'Sample Central Multi-Specialty Hospital (Demo)',
    facilityType: 'Hospital',
    address: 'Park Street Area, Central Kolkata, West Bengal 700016',
    city: 'Kolkata',
    lat: 22.5535,
    lng: 88.3526,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 700, note: 'Illustrative OPD consultation tariff (Demo Data).' },
      'consult-cardiology': { chargeInr: 1200, note: 'Illustrative specialist OPD tariff (Demo Data).' },
      'consult-orthopedics': { chargeInr: 1000, note: 'Illustrative specialist OPD tariff (Demo Data).' },
      'consult-neurology': { chargeInr: 1300, note: 'Illustrative specialist OPD tariff (Demo Data).' },
      'consult-gynecology': { chargeInr: 950, note: 'Illustrative specialist OPD tariff (Demo Data).' },
      'diag-mri-brain': { chargeInr: 6200, note: 'Illustrative plain brain MRI charge (Demo Data).' },
      'diag-ct-chest': { chargeInr: 3800, note: 'Illustrative HRCT chest charge (Demo Data).' },
      'diag-echo-2d': { chargeInr: 2200, note: 'Illustrative 2D Echo charge (Demo Data).' },
      'diag-cbc-panel': { chargeInr: 950, note: 'Illustrative lab panel charge (Demo Data).' },
      'diag-usg-abdomen': { chargeInr: 1400, note: 'Illustrative ultrasound charge (Demo Data).' },
      'treat-lap-cholecystectomy': { chargeInr: 48000, note: 'Illustrative standard ward package (Demo Data).' },
      'treat-coronary-angiography': { chargeInr: 18500, note: 'Illustrative cath-lab package (Demo Data).' },
      'treat-hemodialysis': { chargeInr: 2600, note: 'Illustrative single session charge (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-01a',
        name: 'Sample Park Guest House (Demo)',
        propertyType: 'Guest House',
        address: 'Camac Street Lane, Kolkata 700016',
        lat: 22.5512,
        lng: 88.3548,
        nightlyRateInr: 1650,
      },
      {
        id: 'stay-kol-01b',
        name: 'Sample Midtown Patient Residency (Demo)',
        propertyType: 'Budget Hotel',
        address: 'Free School Street, Kolkata 700016',
        lat: 22.5581,
        lng: 88.3554,
        nightlyRateInr: 2400,
      },
    ],
  },
  {
    id: 'demo-kol-02',
    name: 'Sample Sealdah Diagnostic & Imaging Hub (Demo)',
    facilityType: 'Diagnostic Centre',
    address: 'AJC Bose Road, Entally, Kolkata, West Bengal 700014',
    city: 'Kolkata',
    lat: 22.5612,
    lng: 88.3698,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 500, note: 'Illustrative physician review fee (Demo Data).' },
      'diag-mri-brain': { chargeInr: 4900, note: 'Illustrative 1.5T MRI tariff (Demo Data).' },
      'diag-ct-chest': { chargeInr: 3100, note: 'Illustrative CT chest tariff (Demo Data).' },
      'diag-echo-2d': { chargeInr: 1750, note: 'Illustrative cardiac echo tariff (Demo Data).' },
      'diag-cbc-panel': { chargeInr: 680, note: 'Illustrative blood panel tariff (Demo Data).' },
      'diag-usg-abdomen': { chargeInr: 1050, note: 'Illustrative USG tariff (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-02a',
        name: 'Sample Entally Lodge (Demo)',
        propertyType: 'Lodge',
        address: 'CIT Road, Entally, Kolkata 700014',
        lat: 22.5638,
        lng: 88.3735,
        nightlyRateInr: 1200,
      },
      {
        id: 'stay-kol-02b',
        name: 'Sample Sealdah Station Inn (Demo)',
        propertyType: 'Budget Hotel',
        address: 'APC Road, Kolkata 700009',
        lat: 22.5665,
        lng: 88.3711,
        nightlyRateInr: null, // Intentionally unavailable to test incomplete accommodation cost
      },
    ],
  },
  {
    id: 'demo-kol-03',
    name: 'Sample Hooghly Riverfront Clinic (Demo)',
    facilityType: 'Clinic',
    address: 'Shibpur Main Road, Howrah, West Bengal 711102',
    city: 'Howrah',
    lat: 22.5704,
    lng: 88.3212,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 450, note: 'Illustrative outpatient clinic fee (Demo Data).' },
      'consult-orthopedics': { chargeInr: 750, note: 'Illustrative clinic consultation fee (Demo Data).' },
      'consult-gynecology': { chargeInr: 700, note: 'Illustrative clinic consultation fee (Demo Data).' },
      'diag-cbc-panel': { chargeInr: 620, note: 'Illustrative sample collection panel (Demo Data).' },
      'diag-usg-abdomen': { chargeInr: 950, note: 'Illustrative clinic ultrasound fee (Demo Data).' },
      'treat-cataract-phaco': { chargeInr: 22000, note: 'Illustrative day-care cataract package (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-03a',
        name: 'Sample Howrah Bridge Residency (Demo)',
        propertyType: 'Budget Hotel',
        address: 'GT Road South, Howrah 711101',
        lat: 22.5791,
        lng: 88.3342,
        nightlyRateInr: 1450,
      },
    ],
  },
  {
    id: 'demo-kol-04',
    name: 'Sample Ballygunge Specialty Care Centre (Demo)',
    facilityType: 'Hospital',
    address: 'Gariahat Road, Ballygunge, Kolkata, West Bengal 700019',
    city: 'Kolkata',
    lat: 22.5262,
    lng: 88.3665,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 800, note: 'Illustrative OPD tariff (Demo Data).' },
      'consult-cardiology': { chargeInr: null, note: 'Illustrative record with unavailable published tariff (Demo Data).' },
      'consult-orthopedics': { chargeInr: 1100, note: 'Illustrative OPD tariff (Demo Data).' },
      'consult-gynecology': { chargeInr: 1050, note: 'Illustrative OPD tariff (Demo Data).' },
      'diag-echo-2d': { chargeInr: 2400, note: 'Illustrative diagnostic tariff (Demo Data).' },
      'diag-usg-abdomen': { chargeInr: 1500, note: 'Illustrative diagnostic tariff (Demo Data).' },
      'treat-cataract-phaco': { chargeInr: 29500, note: 'Illustrative phacoemulsification package (Demo Data).' },
      'treat-lap-cholecystectomy': { chargeInr: null, note: 'Package rate unavailable in Demo Data — estimate will be marked incomplete.' },
      'treat-knee-replacement': { chargeInr: 185000, note: 'Illustrative unilateral TKR package (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-04a',
        name: 'Sample Gariahat Family Stay (Demo)',
        propertyType: 'Serviced Apartment',
        address: 'Dover Lane, Ballygunge, Kolkata 700029',
        lat: 22.5218,
        lng: 88.3624,
        nightlyRateInr: 2100,
      },
      {
        id: 'stay-kol-04b',
        name: 'Sample Southern Avenue Inn (Demo)',
        propertyType: 'Hotel',
        address: 'Rashbehari Avenue, Kolkata 700029',
        lat: 22.5174,
        lng: 88.3592,
        nightlyRateInr: 2950,
      },
    ],
  },
  {
    id: 'demo-kol-05',
    name: 'Sample EM Bypass Cardiac & Neuro Institute (Demo)',
    facilityType: 'Specialty Institute',
    address: 'EM Bypass, Mukundapur, Kolkata, West Bengal 700099',
    city: 'Kolkata',
    lat: 22.4955,
    lng: 88.4018,
    offeredServices: {
      'consult-cardiology': { chargeInr: 1400, note: 'Illustrative tertiary cardiac OPD fee (Demo Data).' },
      'consult-neurology': { chargeInr: 1500, note: 'Illustrative tertiary neuro OPD fee (Demo Data).' },
      'consult-orthopedics': { chargeInr: 1250, note: 'Illustrative tertiary ortho OPD fee (Demo Data).' },
      'diag-mri-brain': { chargeInr: 7200, note: 'Illustrative 3T MRI brain tariff (Demo Data).' },
      'diag-ct-chest': { chargeInr: 4300, note: 'Illustrative CT chest tariff (Demo Data).' },
      'diag-echo-2d': { chargeInr: 2600, note: 'Illustrative echo tariff (Demo Data).' },
      'treat-coronary-angiography': { chargeInr: 21000, note: 'Illustrative angiography package (Demo Data).' },
      'treat-knee-replacement': { chargeInr: 215000, note: 'Illustrative knee replacement package (Demo Data).' },
      'treat-hemodialysis': { chargeInr: 3100, note: 'Illustrative inpatient/OPD dialysis charge (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-05a',
        name: 'Sample Mukundapur Patient Guest House (Demo)',
        propertyType: 'Guest House',
        address: 'Nayabad Main Road, Mukundapur, Kolkata 700099',
        lat: 22.4922,
        lng: 88.4055,
        nightlyRateInr: 1350,
      },
      {
        id: 'stay-kol-05b',
        name: 'Sample Bypass Comfort Suites (Demo)',
        propertyType: 'Hotel',
        address: 'Kalikapur Connector, Kolkata 700078',
        lat: 22.5021,
        lng: 88.3991,
        nightlyRateInr: 2750,
      },
    ],
  },
  {
    id: 'demo-kol-06',
    name: 'Sample Salt Lake General & Surgical Hospital (Demo)',
    facilityType: 'Hospital',
    address: 'Sector III, Bidhannagar, Kolkata, West Bengal 700098',
    city: 'Kolkata',
    lat: 22.5748,
    lng: 88.4142,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 750, note: 'Illustrative OPD consultation fee (Demo Data).' },
      'consult-cardiology': { chargeInr: 1150, note: 'Illustrative specialist fee (Demo Data).' },
      'consult-orthopedics': { chargeInr: 1050, note: 'Illustrative specialist fee (Demo Data).' },
      'consult-neurology': { chargeInr: 1200, note: 'Illustrative specialist fee (Demo Data).' },
      'consult-gynecology': { chargeInr: 900, note: 'Illustrative specialist fee (Demo Data).' },
      'diag-mri-brain': { chargeInr: 5800, note: 'Illustrative MRI brain tariff (Demo Data).' },
      'diag-ct-chest': { chargeInr: 3600, note: 'Illustrative CT chest tariff (Demo Data).' },
      'diag-cbc-panel': { chargeInr: 820, note: 'Illustrative lab panel charge (Demo Data).' },
      'treat-lap-cholecystectomy': { chargeInr: 52000, note: 'Illustrative surgical package (Demo Data).' },
      'treat-coronary-angiography': { chargeInr: 17900, note: 'Illustrative angiography package (Demo Data).' },
      'treat-knee-replacement': { chargeInr: 192000, note: 'Illustrative unilateral TKR package (Demo Data).' },
      'treat-hemodialysis': { chargeInr: 2450, note: 'Illustrative dialysis session charge (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-06a',
        name: 'Sample Salt Lake Block GD Guest House (Demo)',
        propertyType: 'Guest House',
        address: 'Sector III, Salt Lake, Kolkata 700106',
        lat: 22.5784,
        lng: 88.4108,
        nightlyRateInr: 1800,
      },
      {
        id: 'stay-kol-06b',
        name: 'Sample Bidhannagar Residency (Demo)',
        propertyType: 'Hotel',
        address: 'Sector II, Salt Lake, Kolkata 700091',
        lat: 22.5831,
        lng: 88.4205,
        nightlyRateInr: 3100,
      },
    ],
  },
  {
    id: 'demo-kol-07',
    name: 'Sample North Kolkata Vision & Eye Institute (Demo)',
    facilityType: 'Specialty Institute',
    address: 'BT Road, Shyambazar, Kolkata, West Bengal 700004',
    city: 'Kolkata',
    lat: 22.6021,
    lng: 88.3738,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 550, note: 'Illustrative pre-op physician fee (Demo Data).' },
      'diag-cbc-panel': { chargeInr: 720, note: 'Illustrative pre-op pathology panel (Demo Data).' },
      'treat-cataract-phaco': { chargeInr: 24500, note: 'Illustrative cataract phaco package (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-07a',
        name: 'Sample Shyambazar Heritage Lodge (Demo)',
        propertyType: 'Lodge',
        address: 'Bhupen Bose Avenue, Kolkata 700004',
        lat: 22.6001,
        lng: 88.3712,
        nightlyRateInr: 1150,
      },
    ],
  },
  {
    id: 'demo-kol-08',
    name: 'Sample Tollygunge Diagnostics & Renal Care (Demo)',
    facilityType: 'Diagnostic Centre',
    address: 'NSC Bose Road, Tollygunge, Kolkata, West Bengal 700040',
    city: 'Kolkata',
    lat: 22.4958,
    lng: 88.3489,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 600, note: 'Illustrative OPD consultation fee (Demo Data).' },
      'diag-mri-brain': { chargeInr: 5100, note: 'Illustrative MRI tariff (Demo Data).' },
      'diag-ct-chest': { chargeInr: 3250, note: 'Illustrative CT tariff (Demo Data).' },
      'diag-echo-2d': { chargeInr: 1850, note: 'Illustrative echo tariff (Demo Data).' },
      'diag-cbc-panel': { chargeInr: 650, note: 'Illustrative pathology panel (Demo Data).' },
      'diag-usg-abdomen': { chargeInr: 1100, note: 'Illustrative ultrasound tariff (Demo Data).' },
      'treat-hemodialysis': { chargeInr: 2200, note: 'Illustrative outpatient dialysis charge (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-08a',
        name: 'Sample Tollygunge Metro Guest House (Demo)',
        propertyType: 'Guest House',
        address: 'Deshapran Sasmal Road, Kolkata 700033',
        lat: 22.4991,
        lng: 88.3452,
        nightlyRateInr: 1500,
      },
    ],
  },
  {
    id: 'demo-kol-09',
    name: 'Sample New Town Tertiary Medical Centre (Demo)',
    facilityType: 'Hospital',
    address: 'Action Area I, New Town, Kolkata, West Bengal 700156',
    city: 'Kolkata',
    lat: 22.5819,
    lng: 88.4589,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 850, note: 'Illustrative OPD fee (Demo Data).' },
      'consult-cardiology': { chargeInr: 1350, note: 'Illustrative specialist fee (Demo Data).' },
      'consult-orthopedics': { chargeInr: 1200, note: 'Illustrative specialist fee (Demo Data).' },
      'consult-neurology': { chargeInr: 1450, note: 'Illustrative specialist fee (Demo Data).' },
      'consult-gynecology': { chargeInr: 1100, note: 'Illustrative specialist fee (Demo Data).' },
      'diag-mri-brain': { chargeInr: 6800, note: 'Illustrative MRI brain charge (Demo Data).' },
      'diag-ct-chest': { chargeInr: 4100, note: 'Illustrative HRCT chest charge (Demo Data).' },
      'diag-echo-2d': { chargeInr: 2500, note: 'Illustrative 2D Echo charge (Demo Data).' },
      'treat-cataract-phaco': { chargeInr: 31000, note: 'Illustrative cataract surgery package (Demo Data).' },
      'treat-lap-cholecystectomy': { chargeInr: 56000, note: 'Illustrative laparoscopic package (Demo Data).' },
      'treat-coronary-angiography': { chargeInr: 19800, note: 'Illustrative angiography package (Demo Data).' },
      'treat-knee-replacement': { chargeInr: 205000, note: 'Illustrative TKR package (Demo Data).' },
      'treat-hemodialysis': { chargeInr: 2900, note: 'Illustrative dialysis charge (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-09a',
        name: 'Sample Action Area Serviced Stay (Demo)',
        propertyType: 'Serviced Apartment',
        address: 'Action Area IB, New Town, Kolkata 700156',
        lat: 22.5801,
        lng: 88.4634,
        nightlyRateInr: 1950,
      },
      {
        id: 'stay-kol-09b',
        name: 'Sample New Town Plaza Hotel (Demo)',
        propertyType: 'Hotel',
        address: 'Major Arterial Road, New Town 700156',
        lat: 22.5868,
        lng: 88.4552,
        nightlyRateInr: 3400,
      },
    ],
  },
  {
    id: 'demo-kol-10',
    name: 'Sample Dum Dum Community Hospital & Diagnostics (Demo)',
    facilityType: 'Hospital',
    address: 'Jessore Road, Nagerbazar, Kolkata, West Bengal 700074',
    city: 'Kolkata',
    lat: 22.6194,
    lng: 88.4062,
    offeredServices: {
      'consult-general-medicine': { chargeInr: 500, note: 'Illustrative OPD fee (Demo Data).' },
      'consult-orthopedics': { chargeInr: 850, note: 'Illustrative specialist fee (Demo Data).' },
      'consult-gynecology': { chargeInr: 800, note: 'Illustrative specialist fee (Demo Data).' },
      'diag-cbc-panel': { chargeInr: 640, note: 'Illustrative lab panel (Demo Data).' },
      'diag-usg-abdomen': { chargeInr: 1000, note: 'Illustrative USG tariff (Demo Data).' },
      'treat-cataract-phaco': { chargeInr: 23000, note: 'Illustrative cataract surgery package (Demo Data).' },
      'treat-lap-cholecystectomy': { chargeInr: 44000, note: 'Illustrative standard package (Demo Data).' },
      'treat-hemodialysis': { chargeInr: 2350, note: 'Illustrative dialysis session (Demo Data).' },
    },
    nearbyStays: [
      {
        id: 'stay-kol-10a',
        name: 'Sample Nagerbazar Guest Lodge (Demo)',
        propertyType: 'Guest House',
        address: 'Dum Dum Road, Kolkata 700074',
        lat: 22.6178,
        lng: 88.4021,
        nightlyRateInr: 1300,
      },
    ],
  },
];

/**
 * Queries the Demo Dataset for providers that explicitly offer the selected medical service,
 * and sorts them strictly by geographical proximity from the user's starting location.
 */
export function queryDemoProviders(
  serviceId: string,
  origin: StartingLocation,
  accommodationRequired: boolean
): ProviderSearchResult[] {
  return DEMO_PROVIDERS.filter((provider) =>
    Object.prototype.hasOwnProperty.call(provider.offeredServices, serviceId)
  )
    .map((provider) => {
      const offering = provider.offeredServices[serviceId];
      const { distanceKm, durationMinutes } = estimateRoadDistanceAndTime(origin, {
        lat: provider.lat,
        lng: provider.lng,
      });

      const accommodations: AccommodationOption[] = accommodationRequired
        ? provider.nearbyStays
            .map((stay) => ({
              id: stay.id,
              name: stay.name,
              propertyType: stay.propertyType,
              address: stay.address,
              lat: stay.lat,
              lng: stay.lng,
              distanceFromHospitalKm: haversineDistanceKm(
                { lat: provider.lat, lng: provider.lng },
                { lat: stay.lat, lng: stay.lng }
              ),
              nightlyRateInr: stay.nightlyRateInr,
              priceSource:
                stay.nightlyRateInr !== null ? ('Demo Data' as const) : ('Unavailable' as const),
              googleMapsUri: null,
              availabilityNotice:
                'Illustrative Demo Data only. Room availability is not verified live.',
            }))
            .sort((a, b) => a.distanceFromHospitalKm - b.distanceFromHospitalKm)
        : [];

      return {
        id: provider.id,
        name: provider.name,
        facilityType: provider.facilityType,
        address: provider.address,
        city: provider.city,
        lat: provider.lat,
        lng: provider.lng,
        phone: null,
        website: null,
        googleMapsUri: null,
        distanceKm,
        durationMinutes,
        distanceSource: 'Demo Data (Estimated Road)' as const,
        medicalChargeInr: offering.chargeInr,
        medicalChargeLabel:
          offering.chargeInr !== null ? 'Demo Medical Charge' : 'Medical Charge Unavailable',
        medicalChargeSource:
          offering.chargeInr !== null ? ('Demo Data' as const) : ('Unavailable' as const),
        medicalChargeNote: offering.note,
        serviceVerificationNote:
          'Service availability is mapped in the illustrative Demo Dataset for workflow testing.',
        accommodations,
        selectedAccommodationId: accommodations[0]?.id ?? null,
        accommodationsLoaded: accommodationRequired,
      };
    })
    // Strict proximity ordering — never ranked by price or ratings
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
