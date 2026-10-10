import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import Overview from './pages/Overview.jsx';
import LiveShipments from './pages/LiveShipments.jsx';
import ShipmentDetail from './pages/ShipmentDetail.jsx';
import TemperatureMonitoring from './pages/TemperatureMonitoring.jsx';
import VaccineBatches from './pages/VaccineBatches.jsx';
import CheckpointsAlerts from './pages/CheckpointsAlerts.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import LVGLMotorControl from './pages/LVGLMotorControl.jsx';
import './styles/global.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  if (appLoading) {
    return <LoadingScreen message="Connecting to telemetry sensors..." />;
  }

  return (
    <div className="app-shell">
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Sidebar />
      </div>
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="app-main">
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/lvgl-control" element={<LVGLMotorControl />} />
            <Route path="/shipments" element={<LiveShipments />} />
            <Route path="/shipments/:id" element={<ShipmentDetail />} />
            <Route path="/temperature" element={<TemperatureMonitoring />} />
            <Route path="/batches" element={<VaccineBatches />} />
            <Route path="/alerts" element={<CheckpointsAlerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
