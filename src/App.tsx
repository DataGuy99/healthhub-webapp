import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { FluidBackground } from './components/FluidBackground';
import { LoginView } from './components/LoginView';
import { isAuthenticated } from './lib/auth';

function App() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const handleLogin = () => {
    setAuthenticated(true);
  };

  return (
    <>
      <FluidBackground />
      {authenticated ? <Dashboard /> : <LoginView onLogin={handleLogin} />}
    </>
  );
}

export default App;
