import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface GasFillup {
  id?: string;
  user_id?: string;
  date: string;
  mileage: number;
  gallons: number;
  cost: number;
  price_per_gallon: number;
  mpg?: number; // Calculated from previous fillup
  notes?: string;
  created_at?: string;
}

// Phase 6.2: Enhanced maintenance interface with projected maintenance fields
interface MaintenanceItem {
  id?: string;
  user_id?: string;
  service_name: string;
  interval_miles: number; // How often (e.g., 5000 for oil change)
  last_done_mileage: number;
  is_active: boolean;
  icon?: string;
  created_at?: string;
  // Phase 6.2: New projected maintenance fields
  is_projected?: boolean; // True if this is a projected future maintenance
  projected_interval_miles?: number; // e.g., 3000 for oil change
  last_completed_mileage?: number; // When last actually completed
  next_due_mileage?: number; // When next maintenance is due
  is_completed?: boolean; // If projected maintenance was completed
  completed_date?: string; // Date when completed
}

export function AutoMPGTracker() {
  const [fillups, setFillups] = useState<GasFillup[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFillup, setShowAddFillup] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);

  // Edit state
  const [editingFillup, setEditingFillup] = useState<GasFillup | null>(null);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceItem | null>(null);

  // Fillup form
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formMileage, setFormMileage] = useState('');
  const [formGallons, setFormGallons] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Maintenance form
  const [maintServiceName, setMaintServiceName] = useState('');
  const [maintIntervalMiles, setMaintIntervalMiles] = useState('');
  const [maintLastDoneMileage, setMaintLastDoneMileage] = useState('');
  const [maintIcon, setMaintIcon] = useState('🔧');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load fillups
      const { data: fillupsData, error: fillupsError } = await supabase
        .from('gas_fillups')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('mileage', { ascending: false });

      if (fillupsError) throw fillupsError;

      // Normalize numeric fields from Supabase
      const normalizedFillups = (fillupsData || []).map((fillup) => ({
        ...fillup,
        mileage: Number(fillup.mileage),
        gallons: Number(fillup.gallons),
        cost: Number(fillup.cost),
        price_per_gallon: Number(fillup.price_per_gallon),
        mpg: fillup.mpg === null ? null : Number(fillup.mpg),
      }));

      setFillups(normalizedFillups);

      // Auto-populate mileage from latest fillup
      if (normalizedFillups.length > 0 && !formMileage) {
        setFormMileage(normalizedFillups[0].mileage.toString());
      }

      // Load maintenance items
      const { data: maintData, error: maintError } = await supabase
        .from('maintenance_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('service_name', { ascending: true });

      if (maintError) throw maintError;

      // Normalize maintenance items
      const normalizedMaintenance = (maintData || []).map((item) => ({
        ...item,
        interval_miles: Number(item.interval_miles),
        last_done_mileage: Number(item.last_done_mileage),
      }));

      setMaintenance(normalizedMaintenance);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const startEditFillup = (fillup: GasFillup) => {
    setEditingFillup(fillup);
    setFormDate(fillup.date);
    setFormMileage(fillup.mileage.toString());
    setFormGallons(fillup.gallons.toString());
    setFormCost(fillup.cost.toString());
    setFormNotes(fillup.notes || '');
    setShowAddFillup(true);
  };

  const addFillup = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!formMileage || !formGallons || !formCost) {
        alert('Please fill in mileage, gallons, and cost');
        return;
      }

      const mileage = parseFloat(formMileage);
      const gallons = parseFloat(formGallons);
      const cost = parseFloat(formCost);

      if (mileage <= 0 || gallons <= 0 || cost <= 0) {
        alert('Values must be greater than 0');
        return;
      }

      const pricePerGallon = cost / gallons;

      // Calculate MPG from previous fillup (only for new fillups)
      let mpg = null;
      if (!editingFillup && fillups.length > 0) {
        const prevFillup = fillups[0]; // Most recent
        if (mileage > prevFillup.mileage) {
          const milesDriven = mileage - prevFillup.mileage;
          mpg = milesDriven / gallons;
        }
      } else if (editingFillup) {
        // Preserve existing MPG during edit to avoid stale calculation
        mpg = editingFillup.mpg ?? null;
      }

      if (editingFillup) {
        // Update existing fillup
        const { error } = await supabase
          .from('gas_fillups')
          .update({
            date: formDate,
            mileage: mileage,
            gallons: gallons,
            cost: cost,
            price_per_gallon: pricePerGallon,
            mpg: mpg,
            notes: formNotes.trim() || null,
          })
          .eq('id', editingFillup.id);

        if (error) throw error;
      } else {
        // Insert new fillup
        const { error } = await supabase
          .from('gas_fillups')
          .insert({
            user_id: user.id,
            date: formDate,
            mileage: mileage,
            gallons: gallons,
            cost: cost,
            price_per_gallon: pricePerGallon,
            mpg: mpg,
            notes: formNotes.trim() || null,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // Reset form
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormMileage('');
      setFormGallons('');
      setFormCost('');
      setFormNotes('');
      setShowAddFillup(false);
      setEditingFillup(null);
      loadData();
    } catch (error) {
      console.error('Error adding fillup:', error);
      alert('Failed to add fillup');
    }
  };

  const startEditMaintenance = (item: MaintenanceItem) => {
    setEditingMaintenance(item);
    setMaintServiceName(item.service_name);
    setMaintIntervalMiles(item.interval_miles.toString());
    setMaintLastDoneMileage(item.last_done_mileage.toString());
    setMaintIcon(item.icon || '🔧');
    setShowAddMaintenance(true);
  };

  const addMaintenanceItem = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!maintServiceName.trim() || !maintIntervalMiles || !maintLastDoneMileage) {
        alert('Please fill in all maintenance fields');
        return;
      }

      const interval = parseInt(maintIntervalMiles);
      const lastDone = parseInt(maintLastDoneMileage);

      if (interval <= 0 || lastDone < 0) {
        alert('Invalid values');
        return;
      }

      if (editingMaintenance) {
        // Update existing maintenance item
        const { error } = await supabase
          .from('maintenance_items')
          .update({
            service_name: maintServiceName.trim(),
            interval_miles: interval,
            last_done_mileage: lastDone,
            icon: maintIcon,
          })
          .eq('id', editingMaintenance.id);

        if (error) throw error;
      } else {
        // Insert new maintenance item
        const { error } = await supabase
          .from('maintenance_items')
          .insert({
            user_id: user.id,
            service_name: maintServiceName.trim(),
            interval_miles: interval,
            last_done_mileage: lastDone,
            is_active: true,
            icon: maintIcon,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // Reset form
      setMaintServiceName('');
      setMaintIntervalMiles('');
      setMaintLastDoneMileage('');
      setMaintIcon('🔧');
      setShowAddMaintenance(false);
      setEditingMaintenance(null);
      loadData();
    } catch (error) {
      console.error('Error adding maintenance item:', error);
      alert('Failed to add maintenance item');
    }
  };

  const completeMaintenance = async (item: MaintenanceItem) => {
    if (!fillups.length) {
      alert('Please log a gas fillup first to get current mileage');
      return;
    }

    const currentMileage = fillups[0].mileage;

    if (!confirm(`Mark "${item.service_name}" as completed at ${currentMileage} miles?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('maintenance_items')
        .update({
          last_done_mileage: currentMileage,
        })
        .eq('id', item.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error completing maintenance:', error);
      alert('Failed to complete maintenance');
    }
  };

  const deleteMaintenance = async (id: string) => {
    if (!confirm('Delete this maintenance item?')) return;

    try {
      const { error } = await supabase
        .from('maintenance_items')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting maintenance:', error);
      alert('Failed to delete maintenance');
    }
  };

  const deleteFillup = async (id: string) => {
    if (!confirm('Delete this fillup? This will affect MPG calculations.')) return;

    try {
      const { error } = await supabase
        .from('gas_fillups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting fillup:', error);
      alert('Failed to delete fillup');
    }
  };

  const getMaintenanceStatus = (item: MaintenanceItem) => {
    if (!fillups.length) return { status: 'unknown', milesUntilDue: 0 };

    const currentMileage = fillups[0].mileage;
    const nextDueMileage = item.last_done_mileage + item.interval_miles;
    const milesUntilDue = nextDueMileage - currentMileage;

    if (milesUntilDue < 0) {
      return { status: 'overdue', milesUntilDue: Math.abs(milesUntilDue) };
    } else if (milesUntilDue <= 500) {
      return { status: 'due-soon', milesUntilDue };
    } else {
      return { status: 'ok', milesUntilDue };
    }
  };

  // Calculate stats
  const currentMileage = fillups.length > 0 ? fillups[0].mileage : 0;
  const avgMPG = fillups.filter(f => f.mpg).reduce((sum, f) => sum + (f.mpg || 0), 0) / fillups.filter(f => f.mpg).length || 0;
  const avgPricePerGallon = fillups.reduce((sum, f) => sum + f.price_per_gallon, 0) / fillups.length || 0;
  const totalSpent = fillups.reduce((sum, f) => sum + f.cost, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">🚗 Auto Tracker</h2>
          <p className="text-white/60 text-sm">Track MPG and maintenance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddMaintenance(!showAddMaintenance)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border border-orange-500/30 text-orange-300 font-medium transition-all"
          >
            {showAddMaintenance ? '✕ Cancel' : '🔧 Add Maintenance'}
          </button>
          <button
            onClick={() => setShowAddFillup(!showAddFillup)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 text-blue-300 font-medium transition-all"
          >
            {showAddFillup ? '✕ Cancel' : '⛽ Log Fillup'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">Current Mileage</div>
          <div className="text-white text-2xl font-bold">{currentMileage.toLocaleString()}</div>
          <div className="text-white/60 text-xs mt-1">miles</div>
        </div>
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">Average MPG</div>
          <div className="text-white text-2xl font-bold">{avgMPG > 0 ? avgMPG.toFixed(1) : '--'}</div>
          <div className="text-white/60 text-xs mt-1">miles per gallon</div>
        </div>
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl border border-yellow-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">Avg Gas Price</div>
          <div className="text-white text-2xl font-bold">${avgPricePerGallon.toFixed(2)}</div>
          <div className="text-white/60 text-xs mt-1">per gallon</div>
        </div>
        <div className="bg-gradient-to-r from-red-500/20 to-rose-500/20 backdrop-blur-xl rounded-2xl border border-red-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">Total Spent</div>
          <div className="text-white text-2xl font-bold">${totalSpent.toFixed(2)}</div>
          <div className="text-white/60 text-xs mt-1">all time</div>
        </div>
      </div>

      {/* Maintenance Alerts */}
      {maintenance.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-white">🔧 Maintenance Schedule</h3>
          {maintenance.map((item) => {
            const { status, milesUntilDue } = getMaintenanceStatus(item);
            const nextDueMileage = item.last_done_mileage + item.interval_miles;

            return (
              <div
                key={item.id}
                className={`backdrop-blur-xl rounded-2xl border p-5 transition-all ${
                  status === 'overdue'
                    ? 'bg-gradient-to-r from-red-500/30 to-rose-500/30 border-red-500/50 ring-2 ring-red-500/30'
                    : status === 'due-soon'
                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-3xl">{item.icon}</div>
                      <div>
                        <div className="font-bold text-white text-lg">{item.service_name}</div>
                        <div className="text-sm text-white/60">
                          Every {item.interval_miles.toLocaleString()} miles
                        </div>
                      </div>
                      {status === 'overdue' && (
                        <span className="px-3 py-1 rounded-lg bg-red-500/30 border border-red-500/50 text-red-300 text-sm font-semibold">
                          🔴 OVERDUE
                        </span>
                      )}
                      {status === 'due-soon' && (
                        <span className="px-3 py-1 rounded-lg bg-yellow-500/30 border border-yellow-500/50 text-yellow-300 text-sm font-semibold">
                          ⚠️ DUE SOON
                        </span>
                      )}
                    </div>
                    <div className="ml-11 grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-white/50 mb-1">Last Done</div>
                        <div className="text-white font-semibold">{item.last_done_mileage.toLocaleString()} mi</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/50 mb-1">Next Due</div>
                        <div className="text-white font-semibold">{nextDueMileage.toLocaleString()} mi</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/50 mb-1">
                          {status === 'overdue' ? 'Overdue By' : 'Miles Until Due'}
                        </div>
                        <div className={`font-semibold ${status === 'overdue' ? 'text-red-400' : status === 'due-soon' ? 'text-yellow-400' : 'text-green-400'}`}>
                          {milesUntilDue.toLocaleString()} mi
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => completeMaintenance(item)}
                      className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-sm transition-all"
                    >
                      ✓ Done
                    </button>
                    <button
                      onClick={() => startEditMaintenance(item)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-sm transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMaintenance(item.id!)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Maintenance Form */}
      {showAddMaintenance && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add Maintenance Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Service Name</label>
              <input
                type="text"
                value={maintServiceName}
                onChange={(e) => setMaintServiceName(e.target.value)}
                placeholder="e.g., Oil Change, Tire Rotation"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Interval (miles)</label>
              <input
                type="number"
                value={maintIntervalMiles}
                onChange={(e) => setMaintIntervalMiles(e.target.value)}
                placeholder="e.g., 5000"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Last Done at (miles)</label>
              <input
                type="number"
                value={maintLastDoneMileage}
                onChange={(e) => setMaintLastDoneMileage(e.target.value)}
                placeholder={currentMileage.toString()}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
          </div>
          <button
            onClick={addMaintenanceItem}
            className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold transition-all"
          >
            {editingMaintenance ? 'Update Maintenance' : 'Add Maintenance'}
          </button>
        </motion.div>
      )}

      {/* Add Fillup Form */}
      {showAddFillup && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Log Gas Fillup</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-gradient-to-r from-white/10 to-white/5 border border-white/30 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:border-white/40 transition-all cursor-pointer backdrop-blur-sm"
                  style={{ colorScheme: 'dark' }}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                  📅
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Mileage</label>
              <input
                type="number"
                value={formMileage}
                onChange={(e) => setFormMileage(e.target.value)}
                placeholder="Current odometer"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Gallons</label>
              <input
                type="number"
                step="0.01"
                value={formGallons}
                onChange={(e) => setFormGallons(e.target.value)}
                placeholder="10.5"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
                placeholder="35.00"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-sm text-white/70 mb-2">Notes (optional)</label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g., Shell, Highway 101"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
          <button
            onClick={addFillup}
            className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold transition-all"
          >
            {editingFillup ? 'Update Fillup' : 'Log Fillup'}
          </button>
        </motion.div>
      )}

      {/* Fillup History */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-white">⛽ Fillup History</h3>
        {fillups.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-white/40 text-lg mb-2">No fillups logged yet</div>
            <div className="text-white/60 text-sm">Click "Log Fillup" to start tracking MPG</div>
          </div>
        ) : (
          fillups.map((fillup) => (
            <div
              key={fillup.id}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 hover:bg-white/8 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-3xl">⛽</div>
                    <div>
                      <div className="font-bold text-white text-lg">
                        {new Date(fillup.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-sm text-white/60">{fillup.mileage.toLocaleString()} miles</div>
                    </div>
                  </div>
                  <div className="ml-11 grid grid-cols-2 md:grid-cols-5 gap-4">
                    {fillup.mpg && (
                      <div>
                        <div className="text-xs text-white/50 mb-1">MPG</div>
                        <div className="text-white text-xl font-bold">{fillup.mpg.toFixed(1)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-white/50 mb-1">Gallons</div>
                      <div className="text-white font-semibold">{fillup.gallons.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-1">Price/Gal</div>
                      <div className="text-white font-semibold">${fillup.price_per_gallon.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-1">Total Cost</div>
                      <div className="text-white font-semibold">${fillup.cost.toFixed(2)}</div>
                    </div>
                  </div>
                  {fillup.notes && (
                    <div className="ml-11 mt-3 text-sm text-white/70 bg-black/20 rounded-lg p-3">
                      {fillup.notes}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditFillup(fillup)}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-sm transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteFillup(fillup.id!)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
