import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, CategoryItem, CategoryLog } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface TreasuryTemplateProps {
  category: string;
  categoryName: string;
  icon: string;
  color: string;
  onBack: () => void;
}

export function TreasuryTemplate({ category, categoryName, icon, color, onBack }: TreasuryTemplateProps) {
  const [assets, setAssets] = useState<CategoryItem[]>([]);
  const [contributions, setContributions] = useState<Map<string, CategoryLog[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddContribution, setShowAddContribution] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetType, setNewAssetType] = useState('');
  const [newAssetInitialValue, setNewAssetInitialValue] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionDate, setContributionDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load assets
      const { data: assetsData, error: assetsError } = await supabase
        .from('category_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', category)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (assetsError) throw assetsError;
      setAssets(assetsData || []);

      // Load all contributions
      const { data: contributionsData, error: contributionsError } = await supabase
        .from('category_logs')
        .select('*, category_items!inner(category)')
        .eq('user_id', user.id)
        .eq('category_items.category', category)
        .order('date', { ascending: false });

      if (contributionsError) throw contributionsError;

      // Group contributions by asset ID
      const contribMap = new Map<string, CategoryLog[]>();
      contributionsData?.forEach((contrib: any) => {
        const itemId = contrib.category_item_id;
        if (!contribMap.has(itemId)) {
          contribMap.set(itemId, []);
        }
        contribMap.get(itemId)!.push(contrib);
      });
      setContributions(contribMap);

      setLoading(false);
    } catch (error) {
      console.error('Error loading treasury data:', error);
      setLoading(false);
    }
  };

  const addAsset = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!newAssetName.trim()) {
        alert('Please enter an asset name');
        return;
      }

      if (!newAssetInitialValue || parseFloat(newAssetInitialValue) < 0) {
        alert('Please enter a valid initial value');
        return;
      }

      const { error } = await supabase
        .from('category_items')
        .insert({
          user_id: user.id,
          category: category,
          name: newAssetName.trim(),
          amount: parseFloat(newAssetInitialValue),
          frequency: 'one-time',
          subcategory: newAssetType.trim() || 'Other',
          description: 'Initial value',
          is_active: true
        });

      if (error) throw error;

      setNewAssetName('');
      setNewAssetType('');
      setNewAssetInitialValue('');
      setShowAddAsset(false);
      loadData();
    } catch (error) {
      console.error('Error adding asset:', error);
      alert('Failed to add asset');
    }
  };

  const addContribution = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!selectedAssetId) {
        alert('Please select an asset');
        return;
      }

      if (!contributionAmount || parseFloat(contributionAmount) === 0) {
        alert('Please enter a valid contribution amount');
        return;
      }

      const { error } = await supabase
        .from('category_logs')
        .insert({
          user_id: user.id,
          category_item_id: selectedAssetId,
          date: contributionDate,
          actual_amount: parseFloat(contributionAmount),
          is_planned: false,
          timestamp: new Date().toISOString()
        });

      if (error) throw error;

      setSelectedAssetId('');
      setContributionAmount('');
      setContributionDate(new Date().toISOString().split('T')[0]);
      setShowAddContribution(false);
      loadData();
    } catch (error) {
      console.error('Error adding contribution:', error);
      alert('Failed to add contribution');
    }
  };

  const deleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      const { error } = await supabase
        .from('category_items')
        .update({ is_active: false })
        .eq('id', assetId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset');
    }
  };

  const calculateTotalContributions = (assetId: string): number => {
    const assetContribs = contributions.get(assetId) || [];
    return assetContribs.reduce((sum, c) => sum + (c.actual_amount || 0), 0);
  };

  const calculateTotalValue = (asset: CategoryItem): number => {
    return (asset.amount || 0) + calculateTotalContributions(asset.id!);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading {categoryName}...</div>
      </div>
    );
  }

  const totalPortfolioValue = assets.reduce((sum, a) => sum + calculateTotalValue(a), 0);
  const totalInitialInvestment = assets.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalContributionsAll = Array.from(contributions.values())
    .flat()
    .reduce((sum, c) => sum + (c.actual_amount || 0), 0);
  const totalGrowth = totalPortfolioValue - totalInitialInvestment - totalContributionsAll;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
          >
            ← Back
          </button>
          <span className="text-4xl">{icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{categoryName}</h1>
            <p className="text-white/60 text-sm">
              {assets.length} asset{assets.length !== 1 ? 's' : ''} in portfolio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddContribution(!showAddContribution)}
            className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
          >
            + Add Contribution
          </button>
          <button
            onClick={() => setShowAddAsset(!showAddAsset)}
            className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-medium transition-all"
          >
            + Add Asset
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Total Value</h3>
          <p className="text-3xl font-bold text-white">${totalPortfolioValue.toFixed(2)}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Initial Investment</h3>
          <p className="text-3xl font-bold text-blue-400">${totalInitialInvestment.toFixed(2)}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Contributions</h3>
          <p className="text-3xl font-bold text-green-400">${totalContributionsAll.toFixed(2)}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Growth</h3>
          <p className={`text-3xl font-bold ${totalGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalGrowth >= 0 ? '+' : ''}${totalGrowth.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Add Asset Form */}
      {showAddAsset && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add New Asset</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Asset name (e.g., 401k, Roth IRA, Bitcoin)"
              value={newAssetName}
              onChange={(e) => setNewAssetName(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <input
              type="text"
              placeholder="Type (e.g., Retirement, Crypto, Stocks)"
              value={newAssetType}
              onChange={(e) => setNewAssetType(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <input
              type="number"
              placeholder="Initial value"
              value={newAssetInitialValue}
              onChange={(e) => setNewAssetInitialValue(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addAsset}
              className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
            >
              Add Asset
            </button>
            <button
              onClick={() => setShowAddAsset(false)}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Add Contribution Form */}
      {showAddContribution && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add Contribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
            >
              <option value="">Select asset...</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.subcategory})
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Contribution amount"
              value={contributionAmount}
              onChange={(e) => setContributionAmount(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
            <div className="relative">
              <input
                type="date"
                value={contributionDate}
                onChange={(e) => setContributionDate(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-gradient-to-r from-white/10 to-white/5 border border-white/30 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 hover:border-white/40 transition-all cursor-pointer backdrop-blur-sm"
                style={{ colorScheme: 'dark' }}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                📅
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addContribution}
              className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
            >
              Add Contribution
            </button>
            <button
              onClick={() => setShowAddContribution(false)}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Assets List */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Portfolio Assets</h2>

        {assets.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            No assets yet. Click "Add Asset" to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => {
              const totalContribs = calculateTotalContributions(asset.id!);
              const totalValue = calculateTotalValue(asset);
              const growth = totalValue - (asset.amount || 0) - totalContribs;
              const growthPercent = (asset.amount || 0) > 0
                ? ((growth / (asset.amount || 0)) * 100)
                : 0;
              const assetContribs = contributions.get(asset.id!) || [];

              return (
                <div
                  key={asset.id}
                  className="p-5 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{asset.name}</h3>
                        <span className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded text-indigo-300 text-xs font-medium">
                          {asset.subcategory}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-white/40">Initial</div>
                          <div className="text-white font-medium">${(asset.amount || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-white/40">Contributions</div>
                          <div className="text-green-400 font-medium">${totalContribs.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-white/40">Growth</div>
                          <div className={`font-medium ${growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {growth >= 0 ? '+' : ''}${growth.toFixed(2)}
                            {growth !== 0 && ` (${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}%)`}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/40">Total Value</div>
                          <div className="text-white font-semibold">${totalValue.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteAsset(asset.id!)}
                      className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Recent Contributions */}
                  {assetContribs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs text-white/40 mb-2">Recent Contributions</div>
                      <div className="flex flex-wrap gap-2">
                        {assetContribs.slice(0, 5).map((contrib) => (
                          <div
                            key={contrib.id}
                            className="px-2 py-1 bg-white/5 rounded text-xs text-white/70"
                          >
                            ${contrib.actual_amount?.toFixed(2)} on {new Date(contrib.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        ))}
                        {assetContribs.length > 5 && (
                          <div className="px-2 py-1 text-xs text-white/40">
                            +{assetContribs.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
