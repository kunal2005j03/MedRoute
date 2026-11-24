import type { User } from 'firebase/auth';

export type ActiveTab = 'planner' | 'compare' | 'tariffs' | 'saved';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  compareCount: number;
  user: User | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Header({
  activeTab,
  onSelectTab,
  compareCount,
  user,
  authLoading,
  onSignIn,
  onSignOut,
}: HeaderProps) {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'planner', label: 'Route Planner' },
    { id: 'compare', label: compareCount > 0 ? `Compare (${compareCount})` : 'Compare' },
    { id: 'tariffs', label: 'Tariff Registry' },
    { id: 'saved', label: 'Saved Plans' },
  ];

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('planner')}
          className="text-xl font-bold tracking-tight text-[#0F2A44] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          MedRoute
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  isActive
                    ? 'text-[#0F2A44] border-[#0F766E]'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary account action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              disabled={authLoading}
              title={user.email || 'Signed in account'}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authLoading}
              className="px-4 py-2 text-xs font-medium text-white bg-[#0F2A44] rounded-md hover:bg-[#173a5c] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? 'Signing In...' : 'Sign In'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-4 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`text-xs font-medium py-1 whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                isActive
                  ? 'text-[#0F2A44] border-[#0F766E]'
                  : 'text-slate-600 border-transparent'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
