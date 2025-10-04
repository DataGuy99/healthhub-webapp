import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { FluidBackground } from './components/FluidBackground';
import { LoginView } from './components/LoginView';
import { supabase } from './lib/supabase';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setAuthenticated(!!session);
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
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
    <div className="relative h-screen md:h-auto overflow-hidden md:overflow-visible">
      <FluidBackground />
      <div className="relative z-10 h-full">
        {authenticated ? <Dashboard /> : <LoginView onLogin={() => {}} />}
      </div>
    </div>
  );
}

export default App;
