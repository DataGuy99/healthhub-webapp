import { useState } from 'react';
import { motion } from 'framer-motion';
import { FinanceView } from './FinanceView';
import { DailySupplementLogger } from './DailySupplementLogger';
import { SupplementsView } from './SupplementsView';
import { SectionsView } from './SectionsView';
import { CostCalculator } from './CostCalculator';
import { CategoryHub } from './CategoryHub';
import { CovenantTemplate } from './CovenantTemplate';
import { ChronicleTemplate } from './ChronicleTemplate';
import { TreasuryTemplate } from './TreasuryTemplate';
import { AnimatedTitle } from './AnimatedTitle';
import { CryptoMetalsTracker } from './CryptoMetalsTracker';
import { clearAuth } from '../lib/auth';

type CategoryTab = 'overview' | 'supplements' | 'grocery' | 'rent' | 'bills' | 'auto' | 'investment' | 'misc-shop' | 'misc-health' | 'home-garden';
type SupplementsSubTab = 'daily' | 'library' | 'sections' | 'costs' | 'export';
type GrocerySubTab = 'items' | 'costs' | 'common';
type AutoSubTab = 'maintenance' | 'gas' | 'costs';
type RentSubTab = 'payments' | 'lease' | 'history';
type BillsSubTab = 'due-dates' | 'tracker' | 'providers';
type InvestmentSubTab = 'portfolio' | 'crypto-metals' | 'performance';
type MiscShopSubTab = 'purchases' | 'wishlist' | 'returns';
type MiscHealthSubTab = 'appointments' | 'records' | 'insurance';
type HomeGardenSubTab = 'projects' | 'maintenance' | 'purchases';

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
  const [supplementsSubTab, setSupplementsSubTab] = useState<SupplementsSubTab>('daily');
  const [grocerySubTab, setGrocerySubTab] = useState<GrocerySubTab>('items');
  const [autoSubTab, setAutoSubTab] = useState<AutoSubTab>('maintenance');
  const [rentSubTab, setRentSubTab] = useState<RentSubTab>('payments');
  const [billsSubTab, setBillsSubTab] = useState<BillsSubTab>('due-dates');
  const [investmentSubTab, setInvestmentSubTab] = useState<InvestmentSubTab>('portfolio');
  const [miscShopSubTab, setMiscShopSubTab] = useState<MiscShopSubTab>('purchases');
  const [miscHealthSubTab, setMiscHealthSubTab] = useState<MiscHealthSubTab>('appointments');
  const [homeGardenSubTab, setHomeGardenSubTab] = useState<HomeGardenSubTab>('projects');

  const handleLogout = async () => {
    await clearAuth();
    window.location.reload();
  };

  // Render sub-tabs based on active category
  const renderSubTabs = () => {
    if (activeTab === 'supplements') {
      const tabs: { id: SupplementsSubTab; label: string; icon: string }[] = [
        { id: 'daily', label: 'Daily Logger', icon: '📝' },
        { id: 'library', label: 'Library', icon: '📚' },
        { id: 'sections', label: 'Sections', icon: '📂' },
        { id: 'costs', label: 'Costs', icon: '💰' },
        { id: 'export', label: 'Export', icon: '📤' },
      ];

      return (
        <div className="flex gap-3 min-w-max pb-2">
          {tabs.map((tab) => {
            const isActive = supplementsSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSupplementsSubTab(tab.id)}
                className={`group relative px-5 py-3 rounded-2xl font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-500/30 to-purple-500/30 backdrop-blur-xl border-2 border-violet-400/50 text-white shadow-lg shadow-violet-500/20 scale-105'
                    : 'bg-white/5 backdrop-blur-sm border-2 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-102'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-pink-600/20 animate-gradient-shift" />
                )}
                <span className="relative flex items-center gap-2">
                  <span className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {tab.icon}
                  </span>
                  <span className="text-sm">{tab.label}</span>
                </span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%]"
                     style={{ transition: 'transform 0.8s ease-in-out' }} />
              </button>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'grocery') {
      const tabs: { id: GrocerySubTab; label: string; icon: string }[] = [
        { id: 'items', label: 'Items', icon: '🛒' },
        { id: 'costs', label: 'Costs', icon: '💰' },
        { id: 'common', label: 'Common Purchases', icon: '⭐' },
      ];

      return (
        <div className="flex gap-3 min-w-max pb-2">
          {tabs.map((tab) => {
            const isActive = grocerySubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setGrocerySubTab(tab.id)}
                className={`group relative px-5 py-3 rounded-2xl font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 backdrop-blur-xl border-2 border-green-400/50 text-white shadow-lg shadow-green-500/20 scale-105'
                    : 'bg-white/5 backdrop-blur-sm border-2 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-102'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-emerald-600/20 to-teal-600/20 animate-gradient-shift" />
                )}
                <span className="relative flex items-center gap-2">
                  <span className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {tab.icon}
                  </span>
                  <span className="text-sm">{tab.label}</span>
                </span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%]"
                     style={{ transition: 'transform 0.8s ease-in-out' }} />
              </button>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'auto') {
      const tabs: { id: AutoSubTab; label: string; icon: string }[] = [
        { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
        { id: 'gas', label: 'Gas Prices', icon: '⛽' },
        { id: 'costs', label: 'Costs', icon: '💰' },
      ];

      return (
        <div className="flex gap-3 min-w-max pb-2">
          {tabs.map((tab) => {
            const isActive = autoSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAutoSubTab(tab.id)}
                className={`group relative px-5 py-3 rounded-2xl font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-red-500/30 to-rose-500/30 backdrop-blur-xl border-2 border-red-400/50 text-white shadow-lg shadow-red-500/20 scale-105'
                    : 'bg-white/5 backdrop-blur-sm border-2 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-102'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-rose-600/20 to-pink-600/20 animate-gradient-shift" />
                )}
                <span className="relative flex items-center gap-2">
                  <span className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {tab.icon}
                  </span>
                  <span className="text-sm">{tab.label}</span>
                </span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%]"
                     style={{ transition: 'transform 0.8s ease-in-out' }} />
              </button>
            );
          })}
        </div>
      );
    }

    // Helper function to render generic sub-tabs
    const renderGenericSubTabs = (
      tabs: Array<{ id: string; label: string; icon: string }>,
      activeSubTab: string,
      setSubTab: (tab: any) => void,
      colorScheme: 'blue' | 'yellow' | 'indigo' | 'pink' | 'teal' | 'lime'
    ) => {
      const colorClasses = {
        blue: { active: 'from-blue-500/30 to-cyan-500/30 border-blue-400/50 shadow-blue-500/20', gradient: 'from-blue-600/20 via-cyan-600/20 to-sky-600/20' },
        yellow: { active: 'from-yellow-500/30 to-orange-500/30 border-yellow-400/50 shadow-yellow-500/20', gradient: 'from-yellow-600/20 via-orange-600/20 to-amber-600/20' },
        indigo: { active: 'from-indigo-500/30 to-violet-500/30 border-indigo-400/50 shadow-indigo-500/20', gradient: 'from-indigo-600/20 via-violet-600/20 to-purple-600/20' },
        pink: { active: 'from-pink-500/30 to-fuchsia-500/30 border-pink-400/50 shadow-pink-500/20', gradient: 'from-pink-600/20 via-fuchsia-600/20 to-rose-600/20' },
        teal: { active: 'from-teal-500/30 to-cyan-500/30 border-teal-400/50 shadow-teal-500/20', gradient: 'from-teal-600/20 via-cyan-600/20 to-sky-600/20' },
        lime: { active: 'from-lime-500/30 to-green-500/30 border-lime-400/50 shadow-lime-500/20', gradient: 'from-lime-600/20 via-green-600/20 to-emerald-600/20' },
      };

      const colors = colorClasses[colorScheme];

      return (
        <div className="flex gap-3 min-w-max pb-2">
          {tabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`group relative px-5 py-3 rounded-2xl font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  isActive
                    ? `bg-gradient-to-r ${colors.active} backdrop-blur-xl border-2 text-white shadow-lg scale-105`
                    : 'bg-white/5 backdrop-blur-sm border-2 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-102'
                }`}
              >
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} animate-gradient-shift`} />
                )}
                <span className="relative flex items-center gap-2">
                  <span className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {tab.icon}
                  </span>
                  <span className="text-sm">{tab.label}</span>
                </span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%]"
                     style={{ transition: 'transform 0.8s ease-in-out' }} />
              </button>
            );
          })}
        </div>
      );
    };

    if (activeTab === 'rent') {
      return renderGenericSubTabs(
        [
          { id: 'payments', label: 'Payments', icon: '💵' },
          { id: 'lease', label: 'Lease Info', icon: '📄' },
          { id: 'history', label: 'History', icon: '📊' },
        ],
        rentSubTab,
        setRentSubTab,
        'blue'
      );
    }

    if (activeTab === 'bills') {
      return renderGenericSubTabs(
        [
          { id: 'due-dates', label: 'Due Dates', icon: '📅' },
          { id: 'tracker', label: 'Payment Tracker', icon: '✅' },
          { id: 'providers', label: 'Providers', icon: '🏢' },
        ],
        billsSubTab,
        setBillsSubTab,
        'yellow'
      );
    }

    if (activeTab === 'investment') {
      return renderGenericSubTabs(
        [
          { id: 'portfolio', label: 'Portfolio', icon: '💼' },
          { id: 'crypto-metals', label: 'Crypto & Metals', icon: '🪙' },
          { id: 'performance', label: 'Performance', icon: '📈' },
        ],
        investmentSubTab,
        setInvestmentSubTab,
        'indigo'
      );
    }

    if (activeTab === 'misc-shop') {
      return renderGenericSubTabs(
        [
          { id: 'purchases', label: 'Purchases', icon: '🛍️' },
          { id: 'wishlist', label: 'Wish List', icon: '⭐' },
          { id: 'returns', label: 'Returns', icon: '↩️' },
        ],
        miscShopSubTab,
        setMiscShopSubTab,
        'pink'
      );
    }

    if (activeTab === 'misc-health') {
      return renderGenericSubTabs(
        [
          { id: 'appointments', label: 'Appointments', icon: '📆' },
          { id: 'records', label: 'Records', icon: '📋' },
          { id: 'insurance', label: 'Insurance', icon: '🏥' },
        ],
        miscHealthSubTab,
        setMiscHealthSubTab,
        'teal'
      );
    }

    if (activeTab === 'home-garden') {
      return renderGenericSubTabs(
        [
          { id: 'projects', label: 'Projects', icon: '🔨' },
          { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
          { id: 'purchases', label: 'Purchases', icon: '🛒' },
        ],
        homeGardenSubTab,
        setHomeGardenSubTab,
        'lime'
      );
    }

    // For categories without sub-tabs
    return null;
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

    // Supplements category with sub-tabs
    if (activeTab === 'supplements') {
      if (supplementsSubTab === 'daily') {
        return <DailySupplementLogger />;
      }
      if (supplementsSubTab === 'library') {
        return <SupplementsView />;
      }
      if (supplementsSubTab === 'sections') {
        return <SectionsView />;
      }
      if (supplementsSubTab === 'costs') {
        return <CostCalculator />;
      }
      if (supplementsSubTab === 'export') {
        // TODO: Create export component
        return (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white">Import / Export</h2>
            <p className="text-white/60 mt-2">Export functionality coming soon...</p>
          </div>
        );
      }
    }

    // Grocery category with sub-tabs
    if (activeTab === 'grocery') {
      const config = CATEGORY_CONFIG[activeTab];
      if (grocerySubTab === 'items') {
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
      if (grocerySubTab === 'costs' || grocerySubTab === 'common') {
        return (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white">{grocerySubTab === 'costs' ? 'Grocery Costs' : 'Common Purchases'}</h2>
            <p className="text-white/60 mt-2">Feature coming soon...</p>
          </div>
        );
      }
    }

    // Auto category with sub-tabs
    if (activeTab === 'auto') {
      const config = CATEGORY_CONFIG[activeTab];
      if (autoSubTab === 'maintenance') {
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
      if (autoSubTab === 'gas' || autoSubTab === 'costs') {
        return (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white">{autoSubTab === 'gas' ? 'Gas Prices' : 'Auto Costs'}</h2>
            <p className="text-white/60 mt-2">Feature coming soon...</p>
          </div>
        );
      }
    }

    // Rent category with sub-tabs
    if (activeTab === 'rent') {
      return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white">🏠 {rentSubTab === 'payments' ? 'Rent Payments' : rentSubTab === 'lease' ? 'Lease Information' : 'Payment History'}</h2>
          <p className="text-white/60 mt-2">Feature coming soon...</p>
        </div>
      );
    }

    // Bills category with sub-tabs
    if (activeTab === 'bills') {
      return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white">💡 {billsSubTab === 'due-dates' ? 'Bill Due Dates' : billsSubTab === 'tracker' ? 'Payment Tracker' : 'Service Providers'}</h2>
          <p className="text-white/60 mt-2">Feature coming soon...</p>
        </div>
      );
    }

    // Investment category with sub-tabs
    if (activeTab === 'investment') {
      if (investmentSubTab === 'crypto-metals') {
        return <CryptoMetalsTracker />;
      }
      // Portfolio and Performance placeholders for now
      return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white">📈 {investmentSubTab === 'portfolio' ? 'Investment Portfolio' : 'Performance Analysis'}</h2>
          <p className="text-white/60 mt-2">Feature coming soon...</p>
        </div>
      );
    }

    // Misc Shop category with sub-tabs
    if (activeTab === 'misc-shop') {
      return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white">🛍️ {miscShopSubTab === 'purchases' ? 'Purchases' : miscShopSubTab === 'wishlist' ? 'Wish List' : 'Returns & Exchanges'}</h2>
          <p className="text-white/60 mt-2">Feature coming soon...</p>
        </div>
      );
    }

    // Misc Health category with sub-tabs
    if (activeTab === 'misc-health') {
      return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white">🏥 {miscHealthSubTab === 'appointments' ? 'Doctor Appointments' : miscHealthSubTab === 'records' ? 'Medical Records' : 'Insurance Info'}</h2>
          <p className="text-white/60 mt-2">Feature coming soon...</p>
        </div>
      );
    }

    // Home & Garden category with sub-tabs
    if (activeTab === 'home-garden') {
      return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white">🌱 {homeGardenSubTab === 'projects' ? 'Home Projects' : homeGardenSubTab === 'maintenance' ? 'Maintenance Schedule' : 'Purchases'}</h2>
          <p className="text-white/60 mt-2">Feature coming soon...</p>
        </div>
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
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all text-sm"
          >
            Logout
          </button>
        </div>

        {/* Tabs - Main or Sub-tabs based on active category */}
        <div className="mt-6 overflow-x-auto scrollbar-hide">
          {activeTab === 'overview' ? (
            // Show main category tabs when on overview
            <div className="flex gap-3 min-w-max pb-2">
              {(Object.keys(CATEGORY_CONFIG) as CategoryTab[]).map((tab) => {
                const config = CATEGORY_CONFIG[tab];
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`group relative px-5 py-3 rounded-2xl font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-500/30 to-purple-500/30 backdrop-blur-xl border-2 border-violet-400/50 text-white shadow-lg shadow-violet-500/20 scale-105'
                        : 'bg-white/5 backdrop-blur-sm border-2 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-102'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-pink-600/20 animate-gradient-shift" />
                    )}
                    <span className="relative flex items-center gap-2">
                      <span className={`text-2xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                        {config.icon}
                      </span>
                      <span className="text-sm">{config.name}</span>
                    </span>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%]"
                         style={{ transition: 'transform 0.8s ease-in-out' }} />
                  </button>
                );
              })}
            </div>
          ) : (
            // Show sub-tabs when in a specific category
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all flex items-center gap-2"
              >
                <span>← Home</span>
              </button>
              <div className="h-8 w-px bg-white/20" />
              {renderSubTabs()}
            </div>
          )}
        </div>

        <style>{`
          @keyframes gradient-shift {
            0%, 100% { opacity: 0.5; transform: translateX(-10%); }
            50% { opacity: 0.8; transform: translateX(10%); }
          }
          .animate-gradient-shift {
            animation: gradient-shift 3s ease-in-out infinite;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scale-102 {
            transform: scale(1.02);
          }
        `}</style>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {renderContent()}
      </div>
    </motion.div>
  );
}
