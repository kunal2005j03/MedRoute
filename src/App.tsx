import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ArrowRight } from 'lucide-react';
import { ComparisonView } from './components/ComparisonView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header, type ActiveTab } from './components/Header';
import { JourneyPlannerForm } from './components/JourneyPlannerForm';
import { ProviderCard } from './components/ProviderCard';
import { ProviderMap } from './components/ProviderMap';
import { SavedPlansView } from './components/SavedPlansView';
import { TariffRegistryView } from './components/TariffRegistryView';
import { queryDemoProviders } from './data/demoDataset';
import { getServiceById, PAN_INDIA_PRESET_LOCATIONS } from './data/services';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import { fetchCuratedTariffs, matchCuratedTariff } from './services/firestoreService';
import {
  checkMapsHealth,
  searchLiveAccommodations,
  searchLiveProviders,
} from './services/mapsApi';
import type {
  DataMode,
  ProviderSearchResult,
  SearchCriteria,
} from './types/medroute';

const INITIAL_CRITERIA: SearchCriteria = {
  category: 'Consultation',
  serviceId: 'consult-general-medicine',
  origin: PAN_INDIA_PRESET_LOCATIONS[0],
  accommodationRequired: false,
  nights: 2,
};

const INITIAL_BATCH_SIZE = 5;

function MedRouteApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('planner');
  const [mode, setMode] = useState<DataMode>('demo');
  const [mapsConfigured, setMapsConfigured] = useState<boolean>(false);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  // Firebase Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Search state
  const [criteria, setCriteria] = useState<SearchCriteria>(INITIAL_CRITERIA);
  const [providers, setProviders] = useState<ProviderSearchResult[]>(() =>
    queryDemoProviders(
      INITIAL_CRITERIA.serviceId,
      INITIAL_CRITERIA.origin,
      INITIAL_CRITERIA.accommodationRequired
    )
  );
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH_SIZE);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(true);

  // Interactive selection state
  const [selectedMapProviderId, setSelectedMapProviderId] = useState<string | null>(null);
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [savedRefreshKey, setSavedRefreshKey] = useState<number>(0);

  // Listen for Tier 1 / Tier 2 Google Maps Platform quota events
  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Check server-side Google Maps Platform configuration
  useEffect(() => {
    let active = true;
    checkMapsHealth()
      .then((status) => {
        if (active) setMapsConfigured(status.mapsConfigured);
      })
      .catch(() => {
        if (active) setMapsConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Firebase Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signOutUser();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setAuthLoading(false);
    }
  };

  const executeSearch = useCallback(
    async (nextCriteria: SearchCriteria, targetMode: DataMode) => {
      setCriteria(nextCriteria);
      setSearchError(null);
      setVisibleCount(INITIAL_BATCH_SIZE);
      setComparedIds([]);
      setSelectedMapProviderId(null);
      setHasSearched(true);

      if (targetMode === 'demo') {
        const results = queryDemoProviders(
          nextCriteria.serviceId,
          nextCriteria.origin,
          nextCriteria.accommodationRequired
        );
        setProviders(results);
        return;
      }

      // Live Mode: never silently replace failed live calls with demo/fabricated data
      const service = getServiceById(nextCriteria.serviceId);
      if (!service) {
        setSearchError('Selected medical service could not be found.');
        setProviders([]);
        return;
      }

      setIsSearching(true);
      try {
        const [livePlaces, curatedTariffs] = await Promise.all([
          searchLiveProviders({
            originLat: nextCriteria.origin.lat,
            originLng: nextCriteria.origin.lng,
            searchQuery: service.liveSearchKeyword,
            radiusMeters: 25000,
          }),
          fetchCuratedTariffs(service.id).catch(() => []),
        ]);

        const mapped: ProviderSearchResult[] = livePlaces
          .map((place) => {
            const matchedTariff = matchCuratedTariff(curatedTariffs, {
              placeId: place.placeId,
              name: place.name,
              address: place.address,
            });

            const distanceKm = place.routeDistanceKm ?? place.straightLineKm;
            return {
              id: place.placeId,
              placeId: place.placeId,
              name: place.name,
              facilityType: place.facilityType,
              address: place.address,
              lat: place.lat,
              lng: place.lng,
              phone: place.phone,
              website: place.website,
              googleMapsUri: place.googleMapsUri,
              distanceKm,
              durationMinutes: place.routeDurationMinutes,
              distanceSource:
                place.routeSource === 'routes-api'
                  ? ('Google Routes API (Live)' as const)
                  : ('Straight-line Distance' as const),
              medicalChargeInr: matchedTariff ? matchedTariff.publishedChargeInr : null,
              medicalChargeLabel: matchedTariff
                ? matchedTariff.chargeType
                : 'Medical Charge Unavailable',
              medicalChargeSource: matchedTariff
                ? ('Curated Tariff (Firestore)' as const)
                : ('Unavailable' as const),
              medicalChargeNote: matchedTariff
                ? `${matchedTariff.chargeType}: ${matchedTariff.sourceNote}`
                : 'No verified published charge is stored in Firestore for this provider and service yet. Add one in the Tariff Registry tab to enable complete live totals.',
              serviceVerificationNote: matchedTariff
                ? 'Matched to a curated service tariff record in Firebase Cloud Firestore. Confirm current appointment availability directly.'
                : 'Discovered via Google Places API (New) using service-related medical keywords. Confirm directly with the facility that this exact service is currently offered.',
              accommodations: [],
              selectedAccommodationId: null,
              accommodationsLoaded: false,
            };
          })
          // Strictly enforce geographical proximity sorting
          .sort((a, b) => a.distanceKm - b.distanceKm);

        setProviders(mapped);
      } catch (err) {
        setProviders([]);
        setSearchError(
          err instanceof Error
            ? err.message
            : 'Unable to retrieve live providers from Google Maps Platform.'
        );
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const handleModeChange = (nextMode: DataMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    void executeSearch(criteria, nextMode);
  };

  const handleToggleCompare = (providerId: string) => {
    setComparedIds((prev) => {
      if (prev.includes(providerId)) {
        return prev.filter((id) => id !== providerId);
      }
      if (prev.length >= 4) return prev;
      return [...prev, providerId];
    });
  };

  const handleSelectAccommodation = (providerId: string, accommodationId: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId ? { ...p, selectedAccommodationId: accommodationId } : p
      )
    );
  };

  const handleCustomAccommodationRate = (
    providerId: string,
    accommodationId: string,
    rateInr: number | null
  ) => {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id !== providerId) return p;
        return {
          ...p,
          accommodations: p.accommodations.map((stay) =>
            stay.id === accommodationId
              ? {
                  ...stay,
                  nightlyRateInr: rateInr,
                  priceSource: rateInr !== null ? 'User Entered' : 'Unavailable',
                }
              : stay
          ),
        };
      })
    );
  };

  const handleLoadLiveAccommodations = async (providerId: string) => {
    const target = providers.find((p) => p.id === providerId);
    if (!target) return;

    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? { ...p, accommodationsLoading: true, accommodationsError: null }
          : p
      )
    );

    try {
      const stays = await searchLiveAccommodations(target.lat, target.lng);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                accommodations: stays,
                selectedAccommodationId: stays[0]?.id ?? null,
                accommodationsLoaded: true,
                accommodationsLoading: false,
                accommodationsError: null,
              }
            : p
        )
      );
    } catch (err) {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                accommodationsLoading: false,
                accommodationsError:
                  err instanceof Error
                    ? err.message
                    : 'Unable to fetch nearby accommodations.',
              }
            : p
        )
      );
    }
  };

  const activeService = useMemo(
    () => getServiceById(criteria.serviceId) ?? null,
    [criteria.serviceId]
  );

  const visibleProviders = useMemo(
    () => providers.slice(0, visibleCount),
    [providers, visibleCount]
  );

  const comparedProviders = useMemo(
    () =>
      comparedIds
        .map((id) => providers.find((p) => p.id === id))
        .filter((p): p is ProviderSearchResult => Boolean(p)),
    [comparedIds, providers]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Mandatory Demo Key Quota Banner (Section 8 Case A) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        compareCount={comparedIds.length}
        user={user}
        authLoading={authLoading}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {authError && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4">
          <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-md px-4 py-2.5">
            {authError}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'planner' && (
          <>
            <JourneyPlannerForm
              mode={mode}
              onModeChange={handleModeChange}
              mapsConfigured={mapsConfigured}
              isSearching={isSearching}
              initialCriteria={criteria}
              onSearch={(nextCriteria) => void executeSearch(nextCriteria, mode)}
            />

            {/* Results Section */}
            {hasSearched && (
              <section aria-label="Nearest healthcare providers" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F2A44]">
                      Nearest Suitable Providers
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {activeService ? `${activeService.category} · ${activeService.name}` : ''}{' '}
                      · Ordered strictly by geographical proximity · Showing{' '}
                      <span className="font-mono tabular-nums font-medium text-slate-800">
                        {visibleProviders.length}
                      </span>{' '}
                      of{' '}
                      <span className="font-mono tabular-nums font-medium text-slate-800">
                        {providers.length}
                      </span>
                    </p>
                  </div>

                  {comparedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('compare')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A44] rounded-md hover:bg-[#173a5c] transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
                    >
                      Compare Selected ({comparedIds.length})
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {searchError && (
                  <div
                    role="alert"
                    className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800"
                  >
                    <p className="font-semibold">Live search could not be completed</p>
                    <p className="mt-1 text-xs">{searchError}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void executeSearch(criteria, 'live')}
                        className="px-3 py-1.5 text-xs font-medium text-red-900 bg-white border border-red-300 rounded-md hover:bg-red-50 cursor-pointer"
                      >
                        Retry Live Search
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModeChange('demo')}
                        className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        Switch to Demo Mode
                      </button>
                    </div>
                  </div>
                )}

                {isSearching ? (
                  <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Querying Google Maps Platform &amp; Cloud Firestore for nearest providers...
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Sorting strictly by geographical proximity from {criteria.origin.label}.
                    </p>
                  </div>
                ) : !searchError && providers.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                    <p className="text-sm font-semibold text-[#0F2A44]">
                      No suitable providers found for this query
                    </p>
                    <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
                      Not every facility offers every medical service. Try selecting a different
                      medical service, adjusting the starting location, or switching between Demo
                      Mode and Live Mode.
                    </p>
                  </div>
                ) : !searchError ? (
                  <div className="space-y-4">
                    <ProviderMap
                      origin={criteria.origin}
                      providers={visibleProviders}
                      selectedProviderId={selectedMapProviderId}
                      mapsConfigured={mapsConfigured}
                      onSelectProvider={setSelectedMapProviderId}
                    />

                    <div className="space-y-3">
                      {visibleProviders.map((provider, index) => (
                        <ProviderCard
                          key={provider.id}
                          rank={index + 1}
                          mode={mode}
                          provider={provider}
                          origin={criteria.origin}
                          accommodationRequired={criteria.accommodationRequired}
                          nights={criteria.nights}
                          isCompared={comparedIds.includes(provider.id)}
                          compareLimitReached={comparedIds.length >= 4}
                          onToggleCompare={handleToggleCompare}
                          onSelectAccommodation={handleSelectAccommodation}
                          onLoadLiveAccommodations={handleLoadLiveAccommodations}
                          onCustomAccommodationRate={handleCustomAccommodationRate}
                          onFocusOnMap={setSelectedMapProviderId}
                        />
                      ))}
                    </div>

                    {visibleCount < providers.length && (
                      <div className="pt-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => prev + INITIAL_BATCH_SIZE)}
                          className="px-5 py-2.5 text-sm font-medium text-[#0F2A44] bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Load More Providers (
                          {Math.min(INITIAL_BATCH_SIZE, providers.length - visibleCount)} more of{' '}
                          {providers.length - visibleCount} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            )}
          </>
        )}

        {activeTab === 'compare' && (
          <ComparisonView
            mode={mode}
            service={activeService}
            origin={criteria.origin}
            accommodationRequired={criteria.accommodationRequired}
            nights={criteria.nights}
            comparedProviders={comparedProviders}
            user={user}
            onRemoveProvider={(id) =>
              setComparedIds((prev) => prev.filter((item) => item !== id))
            }
            onClearAll={() => setComparedIds([])}
            onBackToPlanner={() => setActiveTab('planner')}
            onSignIn={handleSignIn}
            onComparisonSaved={() => setSavedRefreshKey((prev) => prev + 1)}
          />
        )}

        {activeTab === 'tariffs' && (
          <TariffRegistryView
            user={user}
            onSignIn={handleSignIn}
            onTariffsUpdated={() => {
              if (mode === 'live') {
                void executeSearch(criteria, 'live');
              }
            }}
          />
        )}

        {activeTab === 'saved' && (
          <SavedPlansView
            user={user}
            refreshKey={savedRefreshKey}
            onSignIn={handleSignIn}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <p>
            MedRoute · Indicative healthcare journey cost estimator. Estimates are not guaranteed
            final hospital, transport, or lodging expenses.
          </p>
          <p>
            Map &amp; location features subject to{' '}
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-700"
            >
              Google Maps End User Terms
            </a>{' '}
            &amp;{' '}
            <a
              href="https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-700"
            >
              Google Privacy Policy
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MedRouteApp />
    </ErrorBoundary>
  );
}
