import { useState } from 'react';
import { motion } from 'framer-motion';
import { saveAuth } from '../lib/auth';
import { downloadAllData } from '../services/syncService';

export function LoginView({ onLogin }: { onLogin: () => void }) {
  const [passcode, setPasscode] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!userId.trim()) {
      setError('Please enter a User ID');
      return;
    }
    if (!passcode.trim()) {
      setError('Please enter a passcode');
      return;
    }

    setLoading(true);
    setError('');

    saveAuth(userId.trim(), passcode.trim());

    const result = await downloadAllData();

    setLoading(false);

    if (result.success) {
      onLogin();
    } else {
      setError(result.error || 'Failed to sync data. You can still use the app offline.');
      setTimeout(() => {
        onLogin();
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 sm:p-8 w-full max-w-md"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center">HealthHub</h1>
        <p className="text-white/70 text-center mb-6 sm:mb-8 text-sm sm:text-base">Login to sync your data</p>

        <div className="space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2 text-sm sm:text-base">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 text-sm sm:text-base"
              placeholder="Enter your unique ID"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2 text-sm sm:text-base">Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 text-sm sm:text-base"
              placeholder="Enter your passcode"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <p className="text-red-300 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white font-semibold transition-all duration-300 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Syncing...' : 'Login'}
          </button>

          <p className="text-white/50 text-xs sm:text-sm text-center mt-4">
            Your data is stored locally and synced to the cloud using your credentials
          </p>
        </div>
      </motion.div>
    </div>
  );
}
