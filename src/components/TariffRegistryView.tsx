import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { Trash2, PlusCircle } from 'lucide-react';
import {
  getServicesByCategory,
  HEALTHCARE_CATEGORIES,
  INDIAN_STATES,
} from '../data/services';
import {
  createCuratedTariff,
  deleteCuratedTariff,
  fetchCuratedTariffs,
} from '../services/firestoreService';
import type { CuratedTariffRecord, HealthcareCategory } from '../types/medroute';
import { formatInr } from '../utils/costCalculator';

interface TariffRegistryViewProps {
  user: User | null;
  onSignIn: () => void;
  onTariffsUpdated: () => void;
}

export function TariffRegistryView({
  user,
  onSignIn,
  onTariffsUpdated,
}: TariffRegistryViewProps) {
  const [tariffs, setTariffs] = useState<CuratedTariffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Form state
  const [providerName, setProviderName] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [city, setCity] = useState('Kolkata');
  const [stateName, setStateName] = useState('West Bengal');
  const [facilityType, setFacilityType] =
    useState<CuratedTariffRecord['facilityType']>('Hospital');
  const [category, setCategory] = useState<HealthcareCategory>('Consultation');
  const [serviceId, setServiceId] = useState<string>(getServicesByCategory('Consultation')[0].id);
  const [publishedChargeInr, setPublishedChargeInr] = useState('');
  const [chargeType, setChargeType] =
    useState<CuratedTariffRecord['chargeType']>('Published Tariff');
  const [sourceNote, setSourceNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const categoryServices = getServicesByCategory(category);

  const loadTariffs = async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await fetchCuratedTariffs();
      setTariffs(records);
    } catch (err) {
      setError(
        err instanceof Error
          ? 'Unable to load curated tariffs from Firebase Cloud Firestore.'
          : 'Unable to load tariffs.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTariffs();
  }, []);

  useEffect(() => {
    if (!categoryServices.some((s) => s.id === serviceId) && categoryServices[0]) {
      setServiceId(categoryServices[0].id);
    }
  }, [category, categoryServices, serviceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormMessage(null);

    const selectedService = categoryServices.find((s) => s.id === serviceId);
    if (!selectedService) return;

    setSubmitting(true);
    try {
      await createCuratedTariff({
        providerName,
        googlePlaceId,
        city,
        state: stateName,
        facilityType,
        category,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        publishedChargeInr: Number(publishedChargeInr),
        chargeType,
        sourceNote,
      });

      setProviderName('');
      setGooglePlaceId('');
      setPublishedChargeInr('');
      setSourceNote('');
      setFormMessage(
        'Published tariff record saved to Firebase Cloud Firestore. Live Mode searches will now automatically match this provider.'
      );
      await loadTariffs();
      onTariffsUpdated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save tariff record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tariffId: string) => {
    setFormError(null);
    try {
      await deleteCuratedTariff(tariffId);
      setTariffs((prev) => prev.filter((item) => item.id !== tariffId));
      onTariffsUpdated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to delete tariff record.');
    }
  };

  const visibleTariffs =
    filterCategory === 'ALL'
      ? tariffs
      : tariffs.filter((item) => item.category === filterCategory);

  return (
    <section className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6">
        <h2 className="text-xl font-bold text-[#0F2A44]">
          Curated Medical Tariff Registry (Cloud Firestore)
        </h2>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          Because Google Maps Platform does not supply hospital medical charges, MedRoute stores
          verified institutional tariffs in Firebase Cloud Firestore. When you run a Live Mode
          search anywhere in India, MedRoute matches discovered hospitals against these curated
          records by Google Place ID or provider name and city.
        </p>
      </div>

      {/* Add Curated Tariff Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-[#0F2A44]">
              Add Verified Published Tariff Record
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter only genuinely published hospital or diagnostic centre charges with a clear
              source reference.
            </p>
          </div>
          {!user && (
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2A44] rounded-md hover:bg-[#173a5c] cursor-pointer self-start sm:self-auto"
            >
              Sign In with Google to Add Records
            </button>
          )}
        </div>

        {user && (
          <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Hospital / Clinic Name *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={140}
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="Official provider name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Google Place ID (optional, for exact Live match)
              </label>
              <input
                type="text"
                maxLength={160}
                value={googlePlaceId}
                onChange={(e) => setGooglePlaceId(e.target.value)}
                placeholder="e.g. ChIJ..."
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Facility Type *
              </label>
              <select
                value={facilityType}
                onChange={(e) =>
                  setFacilityType(e.target.value as CuratedTariffRecord['facilityType'])
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                <option value="Hospital">Hospital</option>
                <option value="Clinic">Clinic</option>
                <option value="Diagnostic Centre">Diagnostic Centre</option>
                <option value="Specialty Institute">Specialty Institute</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">State *</label>
              <select
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as HealthcareCategory)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {HEALTHCARE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Medical Service *
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {categoryServices.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Published Charge (INR) *
              </label>
              <input
                type="number"
                required
                min={1}
                max={50000000}
                value={publishedChargeInr}
                onChange={(e) => setPublishedChargeInr(e.target.value)}
                placeholder="e.g. 1200"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tariff Basis *
              </label>
              <select
                value={chargeType}
                onChange={(e) =>
                  setChargeType(e.target.value as CuratedTariffRecord['chargeType'])
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                <option value="Published Tariff">Published Tariff</option>
                <option value="Official Package Rate">Official Package Rate</option>
                <option value="Verified Schedule">Verified Schedule</option>
              </select>
            </div>

            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Source Reference Note *
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={200}
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                placeholder="e.g. Hospital OPD rate card verified Nov 2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs">
                {formMessage && <span className="text-[#0F766E]">{formMessage}</span>}
                {formError && <span className="text-red-700">{formError}</span>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-[#0F766E] rounded-md hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                {submitting ? 'Saving Record...' : 'Save Tariff to Firestore'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Stored Tariffs Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#0F2A44]">
            Stored Curated Tariffs ({visibleTariffs.length})
          </h3>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start sm:self-auto">
            {['ALL', ...HEALTHCARE_CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-white text-[#0F2A44] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'ALL' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading curated tariffs from Firestore...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-700">{error}</div>
        ) : visibleTariffs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            No curated tariff records stored in Firestore yet. Sign in above to add verified
            published charges from any Indian hospital or diagnostic centre.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4 text-right">Published Charge</th>
                  <th className="py-3 px-4">Source Note</th>
                  <th className="py-3 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {visibleTariffs.map((record) => {
                  const canDelete =
                    user &&
                    (user.uid === record.createdByUid || user.email === 'mail2kunaln@gmail.com');
                  return (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{record.providerName}</div>
                        <div className="text-xs text-slate-500">{record.facilityType}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {record.city}, {record.state}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-900">{record.serviceName}</div>
                        <div className="text-xs text-slate-500">{record.category}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0F2A44]">
                        {formatInr(record.publishedChargeInr)}
                        <div className="font-sans text-[11px] font-normal text-slate-500">
                          {record.chargeType}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                        {record.sourceNote}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(record.id)}
                            aria-label={`Delete tariff for ${record.providerName}`}
                            className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
