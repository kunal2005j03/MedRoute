import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CuratedTariffRecord,
  DataMode,
  HealthcareCategory,
  SavedComparisonRecord,
} from '../types/medroute';

const TARIFFS_COLLECTION = 'curatedTariffs';
const COMPARISONS_COLLECTION = 'journeyComparisons';

function createSafeDocId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Fetches curated published medical tariffs from Firestore (public read, no PII).
 */
export async function fetchCuratedTariffs(serviceId?: string): Promise<CuratedTariffRecord[]> {
  try {
    const colRef = collection(db, TARIFFS_COLLECTION);
    const q = serviceId
      ? query(colRef, where('serviceId', '==', serviceId), where('publishedChargeInr', '>', 0))
      : query(colRef, where('publishedChargeInr', '>', 0), orderBy('publishedChargeInr', 'asc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((snap) => ({
      id: snap.id,
      ...(snap.data() as Omit<CuratedTariffRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, TARIFFS_COLLECTION);
  }
}

export interface NewTariffInput {
  providerName: string;
  googlePlaceId: string;
  city: string;
  state: string;
  facilityType: CuratedTariffRecord['facilityType'];
  category: HealthcareCategory;
  serviceId: string;
  serviceName: string;
  publishedChargeInr: number;
  chargeType: CuratedTariffRecord['chargeType'];
  sourceNote: string;
}

/**
 * Creates a curated published medical tariff document in Firestore.
 * Synchronized strictly with firebase-blueprint.json and firestore.rules.
 */
export async function createCuratedTariff(input: NewTariffInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in with Google before adding a curated tariff record.');
  }

  const providerName = input.providerName.trim().slice(0, 140);
  const googlePlaceId = input.googlePlaceId.trim().slice(0, 160);
  const city = input.city.trim().slice(0, 80);
  const state = input.state.trim().slice(0, 80);
  const sourceNote = input.sourceNote.trim().slice(0, 200);
  const charge = Math.round(Number(input.publishedChargeInr));

  if (providerName.length < 2) throw new Error('Provider name must be at least 2 characters.');
  if (city.length < 2) throw new Error('City must be at least 2 characters.');
  if (state.length < 2) throw new Error('State must be at least 2 characters.');
  if (sourceNote.length < 3) throw new Error('Please provide a brief source reference note.');
  if (!Number.isFinite(charge) || charge <= 0 || charge > 50000000) {
    throw new Error('Published charge must be a valid positive amount in INR.');
  }

  const docId = createSafeDocId('tariff');
  const docPath = `${TARIFFS_COLLECTION}/${docId}`;

  try {
    await setDoc(doc(db, TARIFFS_COLLECTION, docId), {
      providerName,
      googlePlaceId,
      city,
      state,
      facilityType: input.facilityType,
      category: input.category,
      serviceId: input.serviceId,
      serviceName: input.serviceName.slice(0, 120),
      publishedChargeInr: charge,
      chargeType: input.chargeType,
      sourceNote,
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteCuratedTariff(tariffId: string): Promise<void> {
  const docPath = `${TARIFFS_COLLECTION}/${tariffId}`;
  try {
    await deleteDoc(doc(db, TARIFFS_COLLECTION, tariffId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/**
 * Matches a Live Mode Google Places provider against curated Firestore tariffs
 * by exact Google Place ID first, or normalized provider name + city fallback.
 */
export function matchCuratedTariff(
  tariffs: CuratedTariffRecord[],
  provider: { placeId?: string; name: string; address: string }
): CuratedTariffRecord | null {
  if (tariffs.length === 0) return null;

  if (provider.placeId) {
    const byPlaceId = tariffs.find(
      (t) => t.googlePlaceId && t.googlePlaceId.trim() === provider.placeId
    );
    if (byPlaceId) return byPlaceId;
  }

  const normName = provider.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const normAddr = provider.address.toLowerCase();

  return (
    tariffs.find((t) => {
      const targetName = t.providerName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const cityMatches = normAddr.includes(t.city.toLowerCase());
      const nameMatches =
        normName === targetName ||
        (targetName.length >= 6 && (normName.includes(targetName) || targetName.includes(normName)));
      return cityMatches && nameMatches;
    }) ?? null
  );
}

/**
 * Fetches private saved journey comparisons belonging to the authenticated user.
 */
export async function fetchSavedComparisons(uid: string): Promise<SavedComparisonRecord[]> {
  try {
    const q = query(
      collection(db, COMPARISONS_COLLECTION),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((snap) => ({
      id: snap.id,
      ...(snap.data() as Omit<SavedComparisonRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COMPARISONS_COLLECTION);
  }
}

export interface SaveComparisonInput {
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
}

export async function saveJourneyComparison(input: SaveComparisonInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in with Google to save provider comparisons.');
  }

  const docId = createSafeDocId('cmp');
  const docPath = `${COMPARISONS_COLLECTION}/${docId}`;
  const boundedLines = input.summaryLines
    .slice(0, 4)
    .map((line) => line.trim().slice(0, 220))
    .filter(Boolean);

  if (boundedLines.length === 0) {
    throw new Error('Comparison must include at least one provider summary.');
  }

  try {
    await setDoc(doc(db, COMPARISONS_COLLECTION, docId), {
      ownerId: user.uid,
      title: input.title.trim().slice(0, 140),
      mode: input.mode,
      category: input.category,
      serviceId: input.serviceId,
      serviceName: input.serviceName.trim().slice(0, 120),
      originLabel: input.originLabel.trim().slice(0, 180),
      accommodationRequired: Boolean(input.accommodationRequired),
      nights: input.accommodationRequired ? Math.min(30, Math.max(1, Math.round(input.nights))) : 0,
      providerCount: Math.min(4, Math.max(2, Math.round(input.providerCount))),
      summaryLines: boundedLines,
      createdAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteSavedComparison(comparisonId: string): Promise<void> {
  const docPath = `${COMPARISONS_COLLECTION}/${comparisonId}`;
  try {
    await deleteDoc(doc(db, COMPARISONS_COLLECTION, comparisonId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
