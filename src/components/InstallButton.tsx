import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallButton() {
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

  if (isStandalone) return null;

  return (
    <>
      <button
        onClick={handleInstall}
        className="md:hidden absolute top-4 right-20 px-3 py-1.5 rounded-lg font-medium transition-all duration-300 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-sm"
      >
        Install
      </button>

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
    </>
  );
}
