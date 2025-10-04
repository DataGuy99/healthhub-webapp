import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { FluidBackground } from './components/FluidBackground';
import { LoginView } from './components/LoginView';
import { MobileNav } from './components/MobileNav';
import { InstallPrompt } from './components/InstallPrompt';
import { supabase } from './lib/supabase';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'supplements' | 'sections' | 'costs' | 'export'>('overview');
  const [librarySubTab, setLibrarySubTab] = useState<'supplements' | 'sections'>('supplements');
  const [settingsSubTab, setSettingsSubTab] = useState<'costs' | 'export'>('costs');

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
    <>
      <FluidBackground />
      <div className="relative z-10 min-h-screen">
        {authenticated ? (
          <Dashboard
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            librarySubTab={librarySubTab}
            setLibrarySubTab={setLibrarySubTab}
            settingsSubTab={settingsSubTab}
            setSettingsSubTab={setSettingsSubTab}
          />
        ) : (
          <LoginView onLogin={() => {}} />
        )}
      </div>
      {authenticated && (
        <>
          <MobileNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            librarySubTab={librarySubTab}
            settingsSubTab={settingsSubTab}
          />
          <InstallPrompt />
        </>
      )}
    </>
  );
}

export default App;
