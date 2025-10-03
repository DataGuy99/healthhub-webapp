import { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { FluidBackground } from './components/FluidBackground';
import { LoginView } from './components/LoginView';
import { supabase } from './lib/supabase';
import { offlineData } from './lib/offlineData';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const offlineInitialized = useRef(false);

  useEffect(() => {
    // Check current session and initialize offline DB
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setAuthenticated(!!session);

        // Initialize offline database if user is logged in (only once)
        if (session?.user && !offlineInitialized.current) {
          console.log('🔧 Initializing offline database...');
          try {
            await offlineData.init(session.user.id);
            offlineInitialized.current = true;
            console.log('✅ Offline database ready');
          } catch (error) {
            console.error('Failed to initialize offline database:', error);
          }
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to check session:', error);
        setAuthenticated(false);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setAuthenticated(!!session);

      // Initialize offline DB when user logs in (only if not already initialized)
      if (session?.user && !offlineInitialized.current) {
        try {
          await offlineData.init(session.user.id);
          offlineInitialized.current = true;
        } catch (error) {
          console.error('Failed to initialize offline database:', error);
        }
      }

      // Reset flag on sign out
      if (event === 'SIGNED_OUT') {
        offlineInitialized.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <>
        <FluidBackground />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <FluidBackground />
      {authenticated ? <Dashboard /> : <LoginView onLogin={() => {}} />}
    </>
  );
}

export default App;
