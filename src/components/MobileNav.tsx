import { useState, useEffect } from 'react';

interface MobileNavProps {
  activeTab: 'overview' | 'supplements' | 'sections' | 'costs' | 'export';
  onTabChange: (tab: 'overview' | 'supplements' | 'sections' | 'costs' | 'export') => void;
  librarySubTab: 'supplements' | 'sections';
  settingsSubTab: 'costs' | 'export';
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function MobileNav({ activeTab, onTabChange, librarySubTab, settingsSubTab }: MobileNavProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installed');
    }

    setDeferredPrompt(null);
  };
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
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              aria-label="Install app"
              className="flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 text-green-400 animate-pulse"
            >
              <span className="text-2xl">⬇️</span>
              <span className="text-xs font-medium">Install</span>
            </button>
          )}
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
