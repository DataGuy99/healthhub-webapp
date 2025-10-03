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

    // Safety timeout - force load after 1 second
    const timeout = setTimeout(() => {
      console.warn('Loading timeout - forcing app to load');
      if (isMounted) {
        setLoading(false);
      }
    }, 1000);

    // Check current session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('Session check complete:', session ? 'authenticated' : 'not authenticated');
        if (isMounted) {
          setAuthenticated(!!session);
          setLoading(false);
          clearTimeout(timeout);
        }
      })
      .catch((error) => {
        console.error('Failed to check session:', error);
        if (isMounted) {
          setAuthenticated(false);
          setLoading(false);
          clearTimeout(timeout);
        }
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
