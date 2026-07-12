import { useState } from 'react';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { FullPageLoader } from './components/ui';
import AppShell from './components/AppShell';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import VehiclesPage from './pages/VehiclesPage';
import DriversPage from './pages/DriversPage';
import TripsPage from './pages/TripsPage';
import MaintenancePage from './pages/MaintenancePage';
import FuelPage from './pages/FuelPage';
import ExpensesPage from './pages/ExpensesPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [path, setPath] = useState('dashboard');

  if (loading) return <FullPageLoader label="Loading TransitOps AI…" />;
  if (!session || !profile) return <AuthPage />;

  const renderPage = () => {
    switch (path) {
      case 'dashboard': return <DashboardPage onNavigate={setPath} />;
      case 'vehicles': return <VehiclesPage />;
      case 'drivers': return <DriversPage />;
      case 'trips': return <TripsPage />;
      case 'maintenance': return <MaintenancePage />;
      case 'fuel': return <FuelPage />;
      case 'expenses': return <ExpensesPage />;
      case 'profile': return <ProfilePage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage onNavigate={setPath} />;
    }
  };

  return (
    <AppShell currentPath={path} onNavigate={setPath}>
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
