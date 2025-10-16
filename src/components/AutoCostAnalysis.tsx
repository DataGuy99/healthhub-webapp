import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface GasFillup {
  id: string;
  date: string;
  mileage: number;
  gallons: number;
  cost: number;
  price_per_gallon: number;
  mpg: number | null;
}

interface MaintenanceItem {
  id: string;
  service_name: string;
  last_done_mileage: number;
  estimated_cost: number;
}

export function AutoCostAnalysis() {
  const [loading, setLoading] = useState(true);
  const [fillups, setFillups] = useState<GasFillup[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [analysisData, setAnalysisData] = useState<{
    totalMilesDriven: number;
    totalFuelCost: number;
    totalMaintenanceCost: number;
    averageMPG: number;
    averageGasPrice: number;
    costPerMile: number;
    fuelCostPerMile: number;
    maintenanceCostPerMile: number;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load all gas fillups
      const { data: fillupsData, error: fillupsError } = await supabase
        .from('gas_fillups')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (fillupsError) throw fillupsError;
      setFillups(fillupsData || []);

      // Load maintenance items with estimated costs
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('maintenance_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (maintenanceError) throw maintenanceError;
      setMaintenanceItems(maintenanceData || []);

      // Calculate analysis data
      if (fillupsData && fillupsData.length >= 2) {
        calculateAnalysis(fillupsData, maintenanceData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading auto cost data');
      setLoading(false);
    }
  };

  const calculateAnalysis = (fillups: GasFillup[], maintenance: MaintenanceItem[]) => {
    if (fillups.length < 2) {
      setAnalysisData(null);
      return;
    }

    // Calculate total miles driven
    const firstMileage = fillups[0].mileage;
    const lastMileage = fillups[fillups.length - 1].mileage;
    const totalMilesDriven = lastMileage - firstMileage;

    if (totalMilesDriven <= 0) {
      setAnalysisData(null);
      return;
    }

    // Calculate total fuel cost
    const totalFuelCost = fillups.reduce((sum, f) => sum + f.cost, 0);

    // Calculate average MPG (from fillups that have MPG calculated)
    const fillupsWithMPG = fillups.filter(f => f.mpg !== null && f.mpg > 0);
    const averageMPG = fillupsWithMPG.length > 0
      ? fillupsWithMPG.reduce((sum, f) => sum + (f.mpg || 0), 0) / fillupsWithMPG.length
      : 0;

    // Calculate average gas price
    const averageGasPrice = fillups.reduce((sum, f) => sum + f.price_per_gallon, 0) / fillups.length;

    // Estimate total maintenance cost based on mileage intervals
    // For simplicity, we'll estimate based on how many times each service should have been done
    const totalMaintenanceCost = maintenance.reduce((sum, item) => {
      const serviceInterval = item.last_done_mileage > 0 ? item.last_done_mileage : 5000; // Default 5k miles
      const timesDone = Math.floor(totalMilesDriven / serviceInterval);
      return sum + (timesDone * (item.estimated_cost || 0));
    }, 0);

    // Calculate cost per mile
    const costPerMile = (totalFuelCost + totalMaintenanceCost) / totalMilesDriven;
    const fuelCostPerMile = totalFuelCost / totalMilesDriven;
    const maintenanceCostPerMile = totalMaintenanceCost / totalMilesDriven;

    setAnalysisData({
      totalMilesDriven,
      totalFuelCost,
      totalMaintenanceCost,
      averageMPG,
      averageGasPrice,
      costPerMile,
      fuelCostPerMile,
      maintenanceCostPerMile,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading cost analysis...</div>
      </div>
    );
  }

  if (!analysisData || fillups.length < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-white mb-2">Not Enough Data</h3>
          <p className="text-white/60 mb-4">
            Add at least 2 gas fillups to see your cost-per-mile analysis.
          </p>
          <p className="text-sm text-white/40">
            Track your fillups in the MPG Tracker tab to get started.
          </p>
        </div>
      </motion.div>
    );
  }

  const { totalMilesDriven, totalFuelCost, totalMaintenanceCost, averageMPG, averageGasPrice, costPerMile, fuelCostPerMile, maintenanceCostPerMile } = analysisData;

  // Calculate percentages for visual breakdown
  const totalCost = totalFuelCost + totalMaintenanceCost;
  const fuelPercent = totalCost > 0 ? (totalFuelCost / totalCost) * 100 : 0;
  const maintenancePercent = totalCost > 0 ? (totalMaintenanceCost / totalCost) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Cost-Per-Mile Analysis</h2>
        <p className="text-white/60">
          Comprehensive breakdown of your vehicle operating costs
        </p>
      </div>

      {/* Main Cost-Per-Mile Card */}
      <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-8 text-center">
        <div className="text-sm text-white/60 mb-2">Total Cost Per Mile</div>
        <div className="text-6xl font-bold text-white mb-2">
          ${costPerMile.toFixed(4)}
        </div>
        <div className="text-sm text-white/60">
          Based on {totalMilesDriven.toLocaleString()} miles tracked
        </div>
      </div>

      {/* Cost Breakdown Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="text-white/60 text-sm mb-2">Total Cost</div>
          <div className="text-3xl font-bold text-white mb-1">
            ${totalCost.toFixed(2)}
          </div>
          <div className="text-xs text-white/40">
            Fuel + Maintenance
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="text-white/60 text-sm mb-2">Fuel Cost</div>
          <div className="text-3xl font-bold text-orange-400 mb-1">
            ${totalFuelCost.toFixed(2)}
          </div>
          <div className="text-xs text-white/40">
            {fuelPercent.toFixed(0)}% of total • ${fuelCostPerMile.toFixed(4)}/mi
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="text-white/60 text-sm mb-2">Maintenance Cost</div>
          <div className="text-3xl font-bold text-violet-400 mb-1">
            ${totalMaintenanceCost.toFixed(2)}
          </div>
          <div className="text-xs text-white/40">
            {maintenancePercent.toFixed(0)}% of total • ${maintenanceCostPerMile.toFixed(4)}/mi
          </div>
        </div>
      </div>

      {/* Visual Cost Breakdown */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h3>

        {/* Stacked Bar Chart */}
        <div className="h-12 bg-white/10 rounded-full overflow-hidden flex mb-4">
          <div
            className="bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center text-white text-sm font-semibold"
            style={{ width: `${fuelPercent}%` }}
          >
            {fuelPercent > 15 && `${fuelPercent.toFixed(0)}%`}
          </div>
          <div
            className="bg-gradient-to-r from-violet-500 to-violet-400 flex items-center justify-center text-white text-sm font-semibold"
            style={{ width: `${maintenancePercent}%` }}
          >
            {maintenancePercent > 15 && `${maintenancePercent.toFixed(0)}%`}
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-r from-orange-500 to-orange-400"></div>
            <div>
              <div className="text-white text-sm font-medium">Fuel</div>
              <div className="text-white/60 text-xs">${totalFuelCost.toFixed(2)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-r from-violet-500 to-violet-400"></div>
            <div>
              <div className="text-white text-sm font-medium">Maintenance</div>
              <div className="text-white/60 text-xs">${totalMaintenanceCost.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div className="text-white/60 text-xs mb-1">Miles Driven</div>
          <div className="text-2xl font-bold text-white">
            {totalMilesDriven.toLocaleString()}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div className="text-white/60 text-xs mb-1">Avg MPG</div>
          <div className="text-2xl font-bold text-white">
            {averageMPG.toFixed(1)}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div className="text-white/60 text-xs mb-1">Avg Gas Price</div>
          <div className="text-2xl font-bold text-white">
            ${averageGasPrice.toFixed(3)}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div className="text-white/60 text-xs mb-1">Total Fillups</div>
          <div className="text-2xl font-bold text-white">
            {fillups.length}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-2xl border border-indigo-500/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span>💡</span>
          <span>Insights</span>
        </h3>
        <div className="space-y-2 text-sm text-white/80">
          <p>
            • At ${costPerMile.toFixed(4)} per mile, a 100-mile trip costs you approximately <span className="font-semibold text-white">${(costPerMile * 100).toFixed(2)}</span>
          </p>
          <p>
            • Your fuel efficiency of {averageMPG.toFixed(1)} MPG means you travel <span className="font-semibold text-white">{averageMPG.toFixed(1)} miles</span> per gallon
          </p>
          <p>
            • Maintenance represents <span className="font-semibold text-white">{maintenancePercent.toFixed(0)}%</span> of your total vehicle operating costs
          </p>
          {maintenancePercent < 20 && (
            <p className="text-yellow-300">
              ⚠️ Low maintenance tracking detected. Add estimated costs to maintenance items for more accurate analysis.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
