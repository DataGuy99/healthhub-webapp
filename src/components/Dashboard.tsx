import { useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { AnimatedTitle } from './AnimatedTitle';
import { clearAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

// Lazy load all heavy components
const OverviewDashboard = lazy(() => import('./OverviewDashboard').then(m => ({ default: m.OverviewDashboard })));
const HealthConnectImport = lazy(() => import('./HealthConnectImport').then(m => ({ default: m.HealthConnectImport })));
const HealthTimeline = lazy(() => import('./HealthTimeline').then(m => ({ default: m.HealthTimeline })));
const HealthInsights = lazy(() => import('./HealthInsights').then(m => ({ default: m.HealthInsights })));
const CorrelationHeatmap = lazy(() => import('./CorrelationHeatmap'));
const ROITimeline = lazy(() => import('./ROITimeline'));
const PurchaseFunnel = lazy(() => import('./PurchaseFunnel'));
const PurchaseQueue = lazy(() => import('./PurchaseQueue'));
const ROIAnalyzer = lazy(() => import('./ROIAnalyzer'));
const DailySupplementLogger = lazy(() => import('./DailySupplementLogger').then(m => ({ default: m.DailySupplementLogger })));
const SupplementsView = lazy(() => import('./SupplementsView').then(m => ({ default: m.SupplementsView })));
const SectionsView = lazy(() => import('./SectionsView').then(m => ({ default: m.SectionsView })));
const CostCalculator = lazy(() => import('./CostCalculator').then(m => ({ default: m.CostCalculator })));
const SupplementImportExport = lazy(() => import('./SupplementImportExport').then(m => ({ default: m.SupplementImportExport })));
const CategoryHub = lazy(() => import('./CategoryHub').then(m => ({ default: m.CategoryHub })));
const CovenantTemplate = lazy(() => import('./CovenantTemplate').then(m => ({ default: m.CovenantTemplate })));
const ChronicleTemplate = lazy(() => import('./ChronicleTemplate').then(m => ({ default: m.ChronicleTemplate })));
const TreasuryTemplate = lazy(() => import('./TreasuryTemplate').then(m => ({ default: m.TreasuryTemplate })));
const ProteinCalculator = lazy(() => import('./ProteinCalculator').then(m => ({ default: m.ProteinCalculator })));
const GroceryBudgetTracker = lazy(() => import('./GroceryBudgetTracker').then(m => ({ default: m.GroceryBudgetTracker })));
const SpendingTracker = lazy(() => import('./SpendingTracker').then(m => ({ default: m.SpendingTracker })));
const AutoMPGTracker = lazy(() => import('./AutoMPGTracker').then(m => ({ default: m.AutoMPGTracker })));
const AutoCostAnalysis = lazy(() => import('./AutoCostAnalysis').then(m => ({ default: m.AutoCostAnalysis })));
const BillsCalendar = lazy(() => import('./BillsCalendar').then(m => ({ default: m.BillsCalendar })));
const CryptoMetalsTracker = lazy(() => import('./CryptoMetalsTracker').then(m => ({ default: m.CryptoMetalsTracker })));
const MiscShopTracker = lazy(() => import('./MiscShopTracker').then(m => ({ default: m.MiscShopTracker })));

// Loading component
const Loading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-white/70">Loading...</div>
  </div>
);

type CategoryTab = 'overview' | 'health' | 'grocery' | 'supplements' | 'auto' | 'misc-shop' | 'bills';
// Phase 6.2: Removed 'investment' and 'home-garden' from CategoryTab
type HealthSubTab = 'import' | 'timeline' | 'insights' | 'correlations' | 'heatmap' | 'roi-timeline' | 'funnel' | 'purchase-queue' | 'roi-analysis';
type SupplementsSubTab = 'daily' | 'library' | 'sections' | 'costs' | 'export';
type GrocerySubTab = 'items' | 'protein' | 'budget' | 'costs' | 'common';
type AutoSubTab = 'mpg-tracker' | 'maintenance' | 'gas' | 'costs' | 'cost-analysis';
type BillsSubTab = 'calendar' | 'tracker' | 'providers';
type MiscShopSubTab = 'budget' | 'purchases' | 'wishlist' | 'returns';
// Phase 6.2: Removed InvestmentSubTab and HomeGardenSubTab - categories removed per user feedback

interface DashboardProps {
  activeTab: CategoryTab;
  setActiveTab: (tab: CategoryTab) => void;
}

const CATEGORY_CONFIG: Record<CategoryTab, { name: string; icon: string; color: string }> = {
  'overview': { name: 'Overview', icon: '🏠', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30' },
  'health': { name: 'Health', icon: '❤️', color: 'from-red-500/20 to-pink-500/20 border-red-500/30' },
  'grocery': { name: 'Grocery', icon: '🛒', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  'supplements': { name: 'Supplements', icon: '💊', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30' },
  'auto': { name: 'Auto', icon: '🚗', color: 'from-red-500/20 to-rose-500/20 border-red-500/30' },
  'misc-shop': { name: 'Misc Shopping', icon: '🛍️', color: 'from-pink-500/20 to-fuchsia-500/20 border-pink-500/30' },
  'bills': { name: 'Bills & Payments', icon: '💳', color: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30' },
  // Phase 6.2: Removed 'investment' and 'home-garden' categories
};

export function Dashboard({ activeTab, setActiveTab }: DashboardProps) {
  const [healthSubTab, setHealthSubTab] = useState<HealthSubTab>('import');
  const [supplementsSubTab, setSupplementsSubTab] = useState<SupplementsSubTab>('daily');
  const [grocerySubTab, setGrocerySubTab] = useState<GrocerySubTab>('items');
  const [autoSubTab, setAutoSubTab] = useState<AutoSubTab>('mpg-tracker');
  const [billsSubTab, setBillsSubTab] = useState<BillsSubTab>('calendar');
  const [miscShopSubTab, setMiscShopSubTab] = useState<MiscShopSubTab>('budget');
  const [userId, setUserId] = useState<string>('');
  // Phase 6.2: Removed investmentSubTab and homeGardenSubTab state variables

  // Get user ID from Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const handleLogout = async () => {
    await clearAuth();
    window.location.reload();
  };

  // Render sub-tabs based on active category
  const renderSubTabs = () => {
    if (activeTab === 'health') {
      const tabs: { id: HealthSubTab; label: string; icon: string }[] = [
        { id: 'import', label: 'Import Data', icon: '📥' },
        { id: 'timeline', label: 'Timeline', icon: '📊' },
        { id: 'insights', label: 'Insights', icon: '🧠' },
        { id: 'heatmap', label: 'Heatmap', icon: '🔥' },
        { id: 'roi-timeline', label: 'ROI Timeline', icon: '📈' },
        { id: 'funnel', label: 'Funnel', icon: '🎯' },
        { id: 'purchase-queue', label: 'Queue', icon: '📋' },
        { id: 'roi-analysis', label: 'ROI', icon: '💰' },
      ];

      return (
        <div className="flex gap-3 min-w-max pb-2">
          {tabs.map((tab) => {
            const isActive = healthSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setHealthSubTab(tab.id)}
                className={`group relative px-5 py-3 rounded-2xl font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-red-500/30 to-pink-500/30 backdrop-blur-xl border-2 border-red-400/50 text-white shadow-lg shadow-red-500/20 scale-105'
                    : 'bg-white/5 backdrop-blur-sm border-2 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-102'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-pink-600/20 to-rose-600/20 animate-gradient-shift" />
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
        { id: 'protein', label: 'Protein Calculator', icon: '🥩' },
        { id: 'budget', label: 'Budget Tracker', icon: '💵' },
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
        { id: 'mpg-tracker', label: 'MPG Tracker', icon: '📊' },
        { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
        { id: 'gas', label: 'Gas Prices', icon: '⛽' },
        { id: 'cost-analysis', label: 'Cost Analysis', icon: '💵' },
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

    if (activeTab === 'bills') {
      return renderGenericSubTabs(
        [
          { id: 'calendar', label: 'Calendar', icon: '📅' },
          { id: 'tracker', label: 'Payment Tracker', icon: '✅' },
          { id: 'providers', label: 'Providers', icon: '🏢' },
        ],
        billsSubTab,
        setBillsSubTab,
        'yellow'
      );
    }

    // Phase 6.2: Removed investment sub-tab rendering

    if (activeTab === 'misc-shop') {
      return renderGenericSubTabs(
        [
          { id: 'budget', label: 'Budget Tracker', icon: '💵' },
          { id: 'purchases', label: 'Purchases', icon: '🛍️' },
          { id: 'wishlist', label: 'Wish List', icon: '⭐' },
          { id: 'returns', label: 'Returns', icon: '↩️' },
        ],
        miscShopSubTab,
        setMiscShopSubTab,
        'pink'
      );
    }

    // Phase 6.2: Removed home-garden sub-tab rendering

    // For categories without sub-tabs
    return null;
  };

  const renderContent = () => {
    // Overview shows powerful dashboard with insights
    if (activeTab === 'overview') {
      return (
        <OverviewDashboard
          onCategorySelect={(category) => {
            // Navigate to specific category when clicking from overview
            setActiveTab(category as CategoryTab);
          }}
        />
      );
    }

    // Health category with sub-tabs
    if (activeTab === 'health') {
      if (healthSubTab === 'import') {
        return <HealthConnectImport />;
      }
      if (healthSubTab === 'timeline') {
        return <HealthTimeline />;
      }
      if (healthSubTab === 'insights') {
        return <HealthInsights />;
      }
      if (healthSubTab === 'heatmap') {
        return <CorrelationHeatmap correlations={[]} onCellClick={() => {}} />;
      }
      if (healthSubTab === 'roi-timeline') {
        return <ROITimeline data={[]} timeRange="month" />;
      }
      if (healthSubTab === 'funnel') {
        return userId ? <PurchaseFunnel queueItems={[]} onItemClick={() => {}} /> : null;
      }
      if (healthSubTab === 'purchase-queue') {
        return userId ? <PurchaseQueue userId={userId} availableBudget={1000} /> : null;
      }
      if (healthSubTab === 'roi-analysis') {
        return userId ? <ROIAnalyzer userId={userId} /> : null;
      }
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
        return <SupplementImportExport />;
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
      if (grocerySubTab === 'protein') {
        return <ProteinCalculator />;
      }
      if (grocerySubTab === 'budget') {
        return <GroceryBudgetTracker />;
      }
      if (grocerySubTab === 'common') {
        return (
          <CategoryHub
            category="grocery-common"
            categoryName="Common Purchases"
            icon="⭐"
            color="from-green-500/20 to-emerald-500/20 border-green-500/30"
            onBack={() => setActiveTab('overview')}
          />
        );
      }
      if (grocerySubTab === 'costs') {
        return (
          <SpendingTracker
            category="grocery-costs"
            categoryName="Grocery Spending"
            icon="💰"
            color="from-green-500/20 to-emerald-500/20 border-green-500/30"
            onBack={() => setActiveTab('overview')}
          />
        );
      }
    }

    // Auto category with sub-tabs
    if (activeTab === 'auto') {
      if (autoSubTab === 'mpg-tracker') {
        return <AutoMPGTracker />;
      }
      if (autoSubTab === 'maintenance') {
        return (
          <CategoryHub
            category="auto-maintenance"
            categoryName="Maintenance"
            icon="🔧"
            color="from-red-500/20 to-rose-500/20 border-red-500/30"
            onBack={() => setActiveTab('overview')}
          />
        );
      }
      if (autoSubTab === 'gas') {
        return (
          <ChronicleTemplate
            category="auto-gas"
            categoryName="Gas Fill-ups"
            icon="⛽"
            color="from-red-500/20 to-rose-500/20 border-red-500/30"
            onBack={() => setActiveTab('overview')}
          />
        );
      }
      if (autoSubTab === 'cost-analysis') {
        return <AutoCostAnalysis />;
      }
      if (autoSubTab === 'costs') {
        return (
          <SpendingTracker
            category="auto-costs"
            categoryName="Auto Spending"
            icon="💰"
            color="from-red-500/20 to-rose-500/20 border-red-500/30"
            onBack={() => setActiveTab('overview')}
          />
        );
      }
    }

    // Bills category with sub-tabs
    if (activeTab === 'bills') {
      if (billsSubTab === 'calendar') {
        return <BillsCalendar />;
      }
      // Payment tracker using ChronicleTemplate
      if (billsSubTab === 'tracker') {
        return (
          <ChronicleTemplate
            category="bills-tracker"
            categoryName="Payment Tracker"
            icon="✅"
            color="from-yellow-500/20 to-orange-500/20 border-yellow-500/30"
            onBack={() => setActiveTab('overview')}
          />
        );
      }
      // Service providers using CategoryHub
      return (
        <CategoryHub
          category="bills-providers"
          categoryName="Service Providers"
          icon="🏢"
          color="from-yellow-500/20 to-orange-500/20 border-yellow-500/30"
          onBack={() => setActiveTab('overview')}
        />
      );
    }

    // Phase 6.2: Removed investment category content rendering

    // Misc Shop category with sub-tabs
    if (activeTab === 'misc-shop') {
      const config = CATEGORY_CONFIG[activeTab];
      if (miscShopSubTab === 'budget') {
        return <MiscShopTracker />;
      }
      if (miscShopSubTab === 'purchases') {
        return (
          <ChronicleTemplate
            category="misc-shop-purchases"
            categoryName="Purchases"
            icon="🛍️"
            color={config.color}
            onBack={() => setActiveTab('overview')}
          />
        );
      }
      // Wishlist and Returns use CategoryHub
      if (miscShopSubTab === 'wishlist') {
        return (
          <CategoryHub
            category="misc-shop-wishlist"
            categoryName="Wish List"
            icon="⭐"
            color={config.color}
            onBack={() => setActiveTab('overview')}
          />
        );
      }
      // Returns using ChronicleTemplate
      return (
        <ChronicleTemplate
          category="misc-shop-returns"
          categoryName="Returns & Exchanges"
          icon="🔄"
          color={config.color}
          onBack={() => setActiveTab('overview')}
        />
      );
    }

    // Phase 6.2: Removed home-garden category content rendering

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
            <AnimatedTitle text="Overview" />
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
        <Suspense fallback={<Loading />}>
          {renderContent()}
        </Suspense>
      </div>
    </motion.div>
  );
}
