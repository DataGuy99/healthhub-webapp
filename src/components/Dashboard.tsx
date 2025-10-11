import { motion } from 'framer-motion';
import { FinanceView } from './FinanceView';
import { CategoryHub } from './CategoryHub';
import { CovenantTemplate } from './CovenantTemplate';
import { ChronicleTemplate } from './ChronicleTemplate';
import { TreasuryTemplate } from './TreasuryTemplate';
import { AnimatedTitle } from './AnimatedTitle';
import { InstallButton } from './InstallButton';
import { clearAuth } from '../lib/auth';

type CategoryTab = 'overview' | 'supplements' | 'grocery' | 'rent' | 'bills' | 'auto' | 'investment' | 'misc-shop' | 'misc-health' | 'home-garden';

interface DashboardProps {
  activeTab: CategoryTab;
  setActiveTab: (tab: CategoryTab) => void;
}

const CATEGORY_CONFIG: Record<CategoryTab, { name: string; icon: string; color: string }> = {
  'overview': { name: 'LifeDashHub', icon: '💰', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30' },
  'supplements': { name: 'Supplements', icon: '💊', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30' },
  'grocery': { name: 'Grocery', icon: '🛒', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  'rent': { name: 'Rent', icon: '🏠', color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30' },
  'bills': { name: 'Bills & Utilities', icon: '💡', color: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30' },
  'auto': { name: 'Auto', icon: '🚗', color: 'from-red-500/20 to-rose-500/20 border-red-500/30' },
  'investment': { name: 'Investment', icon: '📈', color: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30' },
  'misc-shop': { name: 'Misc Shopping', icon: '🛍️', color: 'from-pink-500/20 to-fuchsia-500/20 border-pink-500/30' },
  'misc-health': { name: 'Misc Health', icon: '🏥', color: 'from-teal-500/20 to-cyan-500/20 border-teal-500/30' },
  'home-garden': { name: 'Home & Garden', icon: '🌱', color: 'from-lime-500/20 to-green-500/20 border-lime-500/30' },
};

export function Dashboard({ activeTab, setActiveTab }: DashboardProps) {
  const handleLogout = async () => {
    await clearAuth();
    window.location.reload();
  };

  const renderContent = () => {
    // Overview shows LifeDashHub (Finance overview)
    if (activeTab === 'overview') {
      return (
        <FinanceView
          onCategorySelect={(category) => {
            // Navigate to specific category when clicking from overview
            setActiveTab(category as CategoryTab);
          }}
        />
      );
    }

    // Get category config
    const config = CATEGORY_CONFIG[activeTab];

    // Use appropriate template based on category
    // MARKET template: Supplements, Grocery, Auto
    if (activeTab === 'supplements' || activeTab === 'grocery' || activeTab === 'auto') {
      return (
        <CategoryHub
          category={activeTab}
          categoryName={config.name}
          icon={config.icon}
          color={config.color}
          onBack={() => setActiveTab('overview')}
        />
      );
    }

    // COVENANT template: Rent, Bills
    if (activeTab === 'rent' || activeTab === 'bills') {
      return (
        <CovenantTemplate
          category={activeTab}
          categoryName={config.name}
          icon={config.icon}
          color={config.color}
          onBack={() => setActiveTab('overview')}
        />
      );
    }

    // CHRONICLE template: Misc Shop, Misc Health, Home & Garden
    if (activeTab === 'misc-shop' || activeTab === 'misc-health' || activeTab === 'home-garden') {
      return (
        <ChronicleTemplate
          category={activeTab}
          categoryName={config.name}
          icon={config.icon}
          color={config.color}
          onBack={() => setActiveTab('overview')}
        />
      );
    }

    // TREASURY template: Investment
    if (activeTab === 'investment') {
      return (
        <TreasuryTemplate
          category={activeTab}
          categoryName={config.name}
          icon={config.icon}
          color={config.color}
          onBack={() => setActiveTab('overview')}
        />
      );
    }

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen p-4 sm:p-6 pb-24 md:pb-6"
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div onClick={() => setActiveTab('overview')} className="cursor-pointer">
            <AnimatedTitle text="LifeDashHub" />
          </div>
          <div className="flex items-center gap-2">
            <InstallButton />
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {(Object.keys(CATEGORY_CONFIG) as CategoryTab[]).map((tab) => {
              const config = CATEGORY_CONFIG[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-white/20 border border-white/30 text-white'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="mr-2">{config.icon}</span>
                  {config.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {renderContent()}
      </div>
    </motion.div>
  );
}
