interface MobileNavProps {
  activeTab: 'overview' | 'finance' | 'supplements' | 'sections' | 'costs' | 'export';
  onTabChange: (tab: 'overview' | 'finance' | 'supplements' | 'sections' | 'costs' | 'export') => void;
  librarySubTab: 'supplements' | 'sections';
  settingsSubTab: 'costs' | 'export';
}

export function MobileNav({ activeTab, onTabChange, librarySubTab, settingsSubTab }: MobileNavProps) {
  return (
    <div
      className="md:hidden mobile-nav-fixed z-[9999]"
      style={{
        // Use max() to handle Safari's dynamic viewport
        bottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <nav className="bg-white/10 backdrop-blur-xl border-t border-white/20">
        <div
          className="flex justify-around items-center h-16 px-2"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => onTabChange('overview')}
            aria-label="Daily overview"
            aria-current={activeTab === 'overview' ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
              activeTab === 'overview'
                ? 'text-violet-400'
                : 'text-white/60'
            }`}
          >
            <span className="text-2xl">📅</span>
            <span className="text-xs font-medium">Daily</span>
          </button>
          <button
            onClick={() => onTabChange('finance')}
            aria-label="Finance"
            aria-current={activeTab === 'finance' ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
              activeTab === 'finance'
                ? 'text-violet-400'
                : 'text-white/60'
            }`}
          >
            <span className="text-2xl">💰</span>
            <span className="text-xs font-medium">Finance</span>
          </button>
          <button
            onClick={() => onTabChange(librarySubTab)}
            aria-label="Library"
            aria-current={activeTab === 'supplements' || activeTab === 'sections' ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
              activeTab === 'supplements' || activeTab === 'sections'
                ? 'text-violet-400'
                : 'text-white/60'
            }`}
          >
            <span className="text-2xl">💊</span>
            <span className="text-xs font-medium">Library</span>
          </button>
          <button
            onClick={() => onTabChange(settingsSubTab)}
            aria-label="Settings"
            aria-current={activeTab === 'costs' || activeTab === 'export' ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
              activeTab === 'costs' || activeTab === 'export'
                ? 'text-violet-400'
                : 'text-white/60'
            }`}
          >
            <span className="text-2xl">⚙️</span>
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
