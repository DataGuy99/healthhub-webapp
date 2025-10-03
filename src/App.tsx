import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { FluidBackground } from './components/FluidBackground';
import { LoginView } from './components/LoginView';
import { supabase } from './lib/supabase';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    console.log('[App] useEffect starting, isMounted:', isMounted);

    // Safety timeout - force load after 1 second
    const timeout = setTimeout(() => {
      console.warn('[App] Loading timeout triggered - forcing app to load');
      if (isMounted) {
        setLoading(false);
      }
    }, 1000);

    // Check current session
    console.log('[App] Calling supabase.auth.getSession()');
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('[App] Session check complete:', session ? 'authenticated' : 'not authenticated', 'isMounted:', isMounted);
        if (isMounted) {
          setAuthenticated(!!session);
          setLoading(false);
          clearTimeout(timeout);
          console.log('[App] State updated - loading:', false, 'authenticated:', !!session);
        }
      })
      .catch((error) => {
        console.error('[App] Failed to check session:', error);
        if (isMounted) {
          setAuthenticated(false);
          setLoading(false);
          clearTimeout(timeout);
          console.log('[App] Error state updated - loading:', false);
        }
      });

    // Listen for auth changes
    console.log('[App] Setting up auth state change listener');
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[App] Auth state changed:', _event, 'session:', !!session);
      if (isMounted) {
        setAuthenticated(!!session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  console.log('[App] Render - loading:', loading, 'authenticated:', authenticated);

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
