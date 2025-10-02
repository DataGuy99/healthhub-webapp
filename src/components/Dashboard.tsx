import { useState } from 'react';
import { motion } from 'framer-motion';
import { SupplementsView } from './SupplementsView';
import { DailySupplementLogger } from './DailySupplementLogger';
import { AnimatedTitle } from './AnimatedTitle';
import { clearAuth } from '../lib/auth';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'supplements'>('overview');

  const handleLogout = async () => {
    await clearAuth();
    window.location.reload();
  };

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="p-4 sm:p-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <AnimatedTitle />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
              <nav className="flex gap-2 overflow-x-auto">
                {(['overview', 'supplements'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      px-4 sm:px-6 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap text-sm sm:text-base
                      ${activeTab === tab
                        ? 'bg-white/30 backdrop-blur-xl border border-white/40 text-white shadow-lg'
                        : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-white/20'
                      }
                    `}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
              <button
                onClick={handleLogout}
                className="px-4 sm:px-6 py-2 rounded-xl font-medium transition-all duration-300 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm sm:text-base"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <DailySupplementLogger />
            )}

            {activeTab === 'supplements' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <SupplementsView />
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
