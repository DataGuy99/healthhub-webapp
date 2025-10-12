import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface Holding {
  id?: string;
  user_id?: string;
  type: 'crypto' | 'metal';
  symbol: string;
  name: string;
  amount: number;
  purchase_price?: number;
  notes?: string;
  created_at?: string;
}

interface PriceData {
  symbol: string;
  currentPrice: number;
  change24h: number;
  lastUpdated: string;
}

const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'LINK', 'AVAX', 'UNI', 'ATOM'];
const METAL_SYMBOLS = ['XAU', 'XAG', 'XPT', 'XPD']; // Gold, Silver, Platinum, Palladium

export function CryptoMetalsTracker() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHolding, setNewHolding] = useState<Partial<Holding>>({
    type: 'crypto',
    symbol: 'BTC',
    name: 'Bitcoin',
    amount: 0,
  });

  useEffect(() => {
    loadHoldings();
    fetchPrices();
    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadHoldings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('investment_holdings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHoldings(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading holdings:', error);
      setLoading(false);
    }
  };

  const fetchPrices = async () => {
    try {
      // Fetch crypto prices from CoinGecko (free API)
      const cryptoIds = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'matic-network', 'chainlink', 'avalanche-2', 'uniswap', 'cosmos'];
      const cryptoResponse = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds.join(',')}&vs_currencies=usd&include_24hr_change=true`
      );
      const cryptoData = await cryptoResponse.json();

      // Fetch metals prices from Metals-API (using free tier)
      // Note: In production, you'd want to use your own API key
      const metalsResponse = await fetch(
        `https://api.metals.live/v1/spot`
      );
      const metalsData = await metalsResponse.json();

      const priceMap = new Map<string, PriceData>();

      // Map crypto prices
      const cryptoMapping: Record<string, string> = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'ADA': 'cardano',
        'DOT': 'polkadot',
        'MATIC': 'matic-network',
        'LINK': 'chainlink',
        'AVAX': 'avalanche-2',
        'UNI': 'uniswap',
        'ATOM': 'cosmos',
      };

      Object.entries(cryptoMapping).forEach(([symbol, id]) => {
        if (cryptoData[id]) {
          priceMap.set(symbol, {
            symbol,
            currentPrice: cryptoData[id].usd,
            change24h: cryptoData[id].usd_24h_change || 0,
            lastUpdated: new Date().toISOString(),
          });
        }
      });

      // Map metals prices (metals.live returns data in different format)
      if (metalsData && Array.isArray(metalsData)) {
        metalsData.forEach((metal: any) => {
          const symbol = metal.metal?.toUpperCase();
          if (symbol && ['XAU', 'XAG', 'XPT', 'XPD'].includes(symbol)) {
            priceMap.set(symbol, {
              symbol,
              currentPrice: metal.price || 0,
              change24h: metal.change_percent || 0,
              lastUpdated: metal.timestamp || new Date().toISOString(),
            });
          }
        });
      }

      setPrices(priceMap);
    } catch (error) {
      console.error('Error fetching prices:', error);
      // Set fallback mock data for demo
      setPrices(new Map([
        ['BTC', { symbol: 'BTC', currentPrice: 67000, change24h: 2.5, lastUpdated: new Date().toISOString() }],
        ['ETH', { symbol: 'ETH', currentPrice: 3500, change24h: 1.8, lastUpdated: new Date().toISOString() }],
        ['XAU', { symbol: 'XAU', currentPrice: 2650, change24h: 0.5, lastUpdated: new Date().toISOString() }],
        ['XAG', { symbol: 'XAG', currentPrice: 31.5, change24h: -0.3, lastUpdated: new Date().toISOString() }],
      ]));
    }
  };

  const addHolding = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!newHolding.amount || newHolding.amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      const { error } = await supabase
        .from('investment_holdings')
        .insert([{
          ...newHolding,
          user_id: user.id,
          created_at: new Date().toISOString(),
        }]);

      if (error) throw error;

      setNewHolding({ type: 'crypto', symbol: 'BTC', name: 'Bitcoin', amount: 0 });
      setShowAddForm(false);
      loadHoldings();
    } catch (error) {
      console.error('Error adding holding:', error);
      alert('Failed to add holding');
    }
  };

  const deleteHolding = async (id: string) => {
    if (!confirm('Delete this holding?')) return;

    try {
      const { error } = await supabase
        .from('investment_holdings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadHoldings();
    } catch (error) {
      console.error('Error deleting holding:', error);
      alert('Failed to delete holding');
    }
  };

  const calculateValue = (holding: Holding): number => {
    const price = prices.get(holding.symbol);
    return price ? holding.amount * price.currentPrice : 0;
  };

  const calculateGain = (holding: Holding): number | null => {
    if (!holding.purchase_price) return null;
    const currentValue = calculateValue(holding);
    const purchaseValue = holding.amount * holding.purchase_price;
    return ((currentValue - purchaseValue) / purchaseValue) * 100;
  };

  const totalValue = holdings.reduce((sum, h) => sum + calculateValue(h), 0);

  const handleSymbolChange = (symbol: string) => {
    const names: Record<string, string> = {
      'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'SOL': 'Solana', 'ADA': 'Cardano',
      'DOT': 'Polkadot', 'MATIC': 'Polygon', 'LINK': 'Chainlink', 'AVAX': 'Avalanche',
      'UNI': 'Uniswap', 'ATOM': 'Cosmos', 'XAU': 'Gold', 'XAG': 'Silver',
      'XPT': 'Platinum', 'XPD': 'Palladium',
    };
    setNewHolding({ ...newHolding, symbol, name: names[symbol] || symbol });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading portfolio...</div>
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
          <h2 className="text-2xl font-bold text-white">🪙 Crypto & Precious Metals</h2>
          <p className="text-white/60 text-sm">Live market prices • Updates every 60s</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 font-medium transition-all"
        >
          {showAddForm ? '✕ Cancel' : '+ Add Holding'}
        </button>
      </div>

      {/* Total Portfolio Value */}
      <div className="bg-gradient-to-r from-indigo-500/20 to-violet-500/20 backdrop-blur-xl rounded-2xl border border-indigo-500/30 p-6">
        <div className="text-white/70 text-sm mb-1">Total Portfolio Value</div>
        <div className="text-4xl font-bold text-white">
          ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add New Holding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewHolding({ ...newHolding, type: 'crypto', symbol: 'BTC', name: 'Bitcoin' })}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    newHolding.type === 'crypto'
                      ? 'bg-indigo-500/30 border border-indigo-500/50 text-white'
                      : 'bg-white/10 border border-white/20 text-white/60'
                  }`}
                >
                  Crypto
                </button>
                <button
                  onClick={() => setNewHolding({ ...newHolding, type: 'metal', symbol: 'XAU', name: 'Gold' })}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    newHolding.type === 'metal'
                      ? 'bg-yellow-500/30 border border-yellow-500/50 text-white'
                      : 'bg-white/10 border border-white/20 text-white/60'
                  }`}
                >
                  Metal
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Asset</label>
              <select
                value={newHolding.symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {(newHolding.type === 'crypto' ? CRYPTO_SYMBOLS : METAL_SYMBOLS).map((symbol) => (
                  <option key={symbol} value={symbol} className="bg-slate-800">{symbol}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Amount</label>
              <input
                type="number"
                step="0.00000001"
                value={newHolding.amount}
                onChange={(e) => setNewHolding({ ...newHolding, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Purchase Price (optional)</label>
              <input
                type="number"
                step="0.01"
                value={newHolding.purchase_price || ''}
                onChange={(e) => setNewHolding({ ...newHolding, purchase_price: parseFloat(e.target.value) || undefined })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="$0.00"
              />
            </div>
          </div>

          <button
            onClick={addHolding}
            className="mt-4 px-6 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-all"
          >
            Add Holding
          </button>
        </motion.div>
      )}

      {/* Holdings List */}
      <div className="space-y-3">
        {holdings.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-white/40 text-lg mb-2">No holdings yet</div>
            <div className="text-white/60 text-sm">Click "Add Holding" to track your crypto and precious metals</div>
          </div>
        ) : (
          holdings.map((holding) => {
            const priceData = prices.get(holding.symbol);
            const currentValue = calculateValue(holding);
            const gainPercent = calculateGain(holding);

            return (
              <div
                key={holding.id}
                className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 hover:bg-white/8 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                        holding.type === 'crypto' ? 'bg-indigo-500/20' : 'bg-yellow-500/20'
                      }`}>
                        {holding.type === 'crypto' ? '₿' : '🥇'}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{holding.name}</div>
                        <div className="text-sm text-white/60">{holding.symbol}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-white/50 mb-1">Amount</div>
                        <div className="text-white font-medium">{holding.amount.toFixed(8)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/50 mb-1">Current Price</div>
                        <div className="text-white font-medium">
                          ${priceData?.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-white/50 mb-1">Value</div>
                        <div className="text-white font-medium">
                          ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-white/50 mb-1">24h Change</div>
                        <div className={`font-medium ${(priceData?.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(priceData?.change24h || 0) >= 0 ? '+' : ''}{priceData?.change24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {gainPercent !== null && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-white/50 mb-1">Total Gain/Loss</div>
                        <div className={`text-lg font-semibold ${gainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteHolding(holding.id!)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
