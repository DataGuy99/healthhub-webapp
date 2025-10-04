import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (running as standalone)
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                               (window.navigator as any).standalone ||
                               document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

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
    if (deferredPrompt) {
      // Chrome/Edge
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('PWA installed');
      }

      setDeferredPrompt(null);
    } else {
      // Firefox or other browsers - show instructions
      setShowInstallModal(true);
    }
  };

  const detectBrowser = () => {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    return 'Browser';
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
          {!isStandalone && (
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

      {/* Install Instructions Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowInstallModal(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-sm w-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-xl rounded-2xl border border-white/20 p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💊</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Install HealthHub</h3>
                  <p className="text-white/70 text-sm">Add to home screen</p>
                </div>
              </div>

              <div className="space-y-3 text-white/90 text-sm mb-6">
                {detectBrowser() === 'Firefox' ? (
                  <>
                    <p className="font-medium text-purple-300">Firefox Instructions:</p>
                    <ol className="space-y-2 pl-4 list-decimal">
                      <li>Tap the menu button (three dots)</li>
                      <li>Tap "Install"</li>
                      <li>Confirm by tapping "Add"</li>
                    </ol>
                  </>
                ) : detectBrowser() === 'Safari' ? (
                  <>
                    <p className="font-medium text-purple-300">Safari Instructions:</p>
                    <ol className="space-y-2 pl-4 list-decimal">
                      <li>Tap the Share button</li>
                      <li>Scroll down and tap "Add to Home Screen"</li>
                      <li>Tap "Add"</li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-purple-300">Chrome Instructions:</p>
                    <ol className="space-y-2 pl-4 list-decimal">
                      <li>Tap the menu button (three dots)</li>
                      <li>Tap "Add to Home screen"</li>
                      <li>Tap "Add"</li>
                    </ol>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowInstallModal(false)}
                className="w-full px-4 py-3 bg-purple-500/30 hover:bg-purple-500/40 border border-purple-500/50 rounded-xl text-white font-medium transition-all"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
