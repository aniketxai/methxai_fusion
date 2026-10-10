import { NavLink } from 'react-router-dom';
import { LayoutGrid, Truck, Thermometer, Package, Bell, FileText, Settings, Cpu } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/lvgl-control', label: 'LVGL & Motor Control', icon: Cpu },
  { to: '/shipments', label: 'Live Shipments', icon: Truck },
  { to: '/temperature', label: 'Temperature Monitoring', icon: Thermometer },
  { to: '/batches', label: 'Vaccine Batches', icon: Package },
  { to: '/alerts', label: 'Checkpoints & Alerts', icon: Bell },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E293B', background: '#090D16' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.8px' }}>SYSTEM NAVIGATION</div>
        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Node ID: ESP32-SLOT-04</div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={15} strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-footer" style={{ borderTop: '1px solid #1E293B', padding: '14px 16px', background: '#090D16' }}>
        <div className="sidebar-footer-label" style={{ fontWeight: 600, color: '#F1F5F9', fontSize: '11px' }}>MethXAI Fusion v2.4</div>
        <div className="sidebar-footer-sub" style={{ fontSize: '10px', color: '#64748B' }}>ESP32 UART Mesh / WHO TRS 961</div>
      </div>
    </aside>
  );
}
