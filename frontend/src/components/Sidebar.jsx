import { NavLink } from 'react-router-dom';
import { LayoutGrid, Truck, Thermometer, Package, Bell, FileText, Settings } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
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
      <div className="sidebar-brand">
        <img src="/logo.jpg" alt="MethXAI Logo" className="sidebar-logo" />
        <div>
          <span className="brand-name">MethXAI</span>
          <span className="brand-tag">Cold Chain v1.0</span>
        </div>
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
      <div className="sidebar-footer">
        <div className="sidebar-footer-label">IOT-03 Demo Build</div>
        <div className="sidebar-footer-sub">Hackathon Prototype</div>
      </div>
    </aside>
  );
}
