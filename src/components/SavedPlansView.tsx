import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { Trash2 } from 'lucide-react';
import {
  deleteSavedComparison,
  fetchSavedComparisons,
} from '../services/firestoreService';
import type { SavedComparisonRecord } from '../types/medroute';

interface SavedPlansViewProps {
  user: User | null;
  refreshKey: number;
  onSignIn: () => void;
}

export function SavedPlansView({ user, refreshKey, onSignIn }: SavedPlansViewProps) {
  const [plans, setPlans] = useState<SavedComparisonRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPlans([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchSavedComparisons(user.uid);
        if (!cancelled) setPlans(list);
      } catch {
        if (!cancelled) setError('Unable to load saved comparisons from Firestore.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  const handleDelete = async (id: string) => {
    try {
      await deleteSavedComparison(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Unable to delete saved plan.');
    }
  };

  if (!user) {
    return (
      <section className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <h2 className="text-lg font-semibold text-[#0F2A44]">Saved Medical Journey Comparisons</h2>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Sign in with your Google account to save and revisit side-by-side provider cost
          comparisons securely in Firebase Cloud Firestore.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-[#0F2A44] rounded-md hover:bg-[#173a5c] transition-colors cursor-pointer"
        >
          Sign In with Google
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-xl font-bold text-[#0F2A44]">Saved Journey Comparisons</h2>
        <p className="mt-1 text-xs text-slate-600">
          Private comparison snapshots stored for {user.email}.
        </p>
      </div>

      {loading && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
          Loading saved comparisons...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
          You have not saved any provider comparisons yet. Select 2 to 4 providers in the Route
          Planner, open Compare, and click Save Comparison.
        </div>
      )}

      <div className="space-y-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
          >
            <div>
              <div className="text-xs text-slate-500">
                <span>{plan.mode === 'demo' ? 'Demo Mode' : 'Live Mode'}</span>
                <span aria-hidden="true"> · </span>
                <span>{plan.category}</span>
                <span aria-hidden="true"> · </span>
                <span>
                  {plan.accommodationRequired
                    ? `${plan.nights} ${plan.nights === 1 ? 'night' : 'nights'} stay`
                    : 'No accommodation'}
                </span>
              </div>
              <h3 className="mt-1 text-base font-semibold text-[#0F2A44]">{plan.title}</h3>
              <p className="mt-0.5 text-xs text-slate-600">From: {plan.originLabel}</p>

              <ul className="mt-3 space-y-1 text-xs text-slate-700 font-mono tabular-nums">
                {plan.summaryLines.map((line, i) => (
                  <li key={`${plan.id}-${i}`}>{line}</li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleDelete(plan.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:text-red-700 hover:border-red-200 cursor-pointer self-start shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
