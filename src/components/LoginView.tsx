import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { signIn, signUp } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';

export function LoginView({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConfigError(true);
      setError('⚠️ Database connection not configured. Please check environment variables.');
    }
  }, []);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter an email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setLoading(true);
    setError('');

    const result = isSignUp
      ? await signUp(email.trim(), password.trim())
      : await signIn(email.trim(), password.trim());

    if (result.success) {
      setLoading(false);
      onLogin();
    } else {
      setError(result.error || 'Authentication failed');
      setLoading(false);
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
        <p className="text-white/70 text-center mb-6 sm:mb-8 text-sm sm:text-base">
          {isSignUp ? 'Create your account' : 'Sign in to continue'}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2 text-sm sm:text-base">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 text-sm sm:text-base"
              placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2 text-sm sm:text-base">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 text-sm sm:text-base"
              placeholder="Enter your password"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && (
            <div className={`p-3 rounded-lg text-sm ${configError ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-300' : 'bg-red-500/20 border border-red-500/30 text-red-300'}`}>
              <div className="font-semibold mb-1">{configError ? 'Configuration Error' : 'Error'}</div>
              <div>{error}</div>
              {configError && (
                <div className="mt-2 text-xs">
                  <strong>Fix:</strong> Set environment variables in Netlify:
                  <br />• VITE_SUPABASE_URL
                  <br />• VITE_SUPABASE_ANON_KEY
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || configError}
            className="w-full px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white font-semibold transition-all duration-300 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>

          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="w-full text-white/70 hover:text-white text-sm transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>

          <p className="text-white/50 text-xs sm:text-sm text-center mt-4">
            Your supplement data is securely stored in the cloud with Supabase
          </p>
        </div>
      </motion.div>
    </div>
  );
}
