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

        // Always set loading to false first - don't block on offline init
        setLoading(false);

        // Initialize offline database in background (non-blocking)
        if (session?.user && !offlineInitialized.current) {
          console.log('🔧 Initializing offline database in background...');
          offlineData.init(session.user.id)
            .then(() => {
              offlineInitialized.current = true;
              console.log('✅ Offline database ready');
            })
            .catch((error) => {
              console.error('Failed to initialize offline database:', error);
              // App still works, just no offline support
            });
        }
      })
      .catch((error) => {
        console.error('Failed to check session:', error);
        setAuthenticated(false);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthenticated(!!session);

      // Initialize offline DB in background when user logs in
      if (session?.user && !offlineInitialized.current) {
        offlineData.init(session.user.id)
          .then(() => {
            offlineInitialized.current = true;
          })
          .catch((error) => {
            console.error('Failed to initialize offline database:', error);
          });
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
