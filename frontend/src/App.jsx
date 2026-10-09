import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Overview from './pages/Overview.jsx';
import LiveShipments from './pages/LiveShipments.jsx';
import ShipmentDetail from './pages/ShipmentDetail.jsx';
import TemperatureMonitoring from './pages/TemperatureMonitoring.jsx';
import VaccineBatches from './pages/VaccineBatches.jsx';
import CheckpointsAlerts from './pages/CheckpointsAlerts.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import './styles/global.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <Header />
        <div className="header-mobile-bar" style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={16} />
          </div>
        </div>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Overview />} />
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
