type CategoryTab = 'overview' | 'supplements' | 'grocery' | 'rent' | 'bills' | 'auto' | 'investment' | 'misc-shop' | 'misc-health' | 'home-garden';

interface MobileNavProps {
  activeTab: CategoryTab;
  onTabChange: (tab: CategoryTab) => void;
}

const NAV_ITEMS: Array<{ id: CategoryTab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '💰' },
  { id: 'supplements', label: 'Supps', icon: '💊' },
  { id: 'grocery', label: 'Grocery', icon: '🛒' },
  { id: 'auto', label: 'Auto', icon: '🚗' },
];

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
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
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
                activeTab === item.id
                  ? 'text-violet-400'
                  : 'text-white/60'
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
