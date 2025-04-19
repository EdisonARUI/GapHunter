import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, LineChart, History, Settings } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const location = useLocation();

  const navItems = [
    { path: '/create-task', label: 'Task', icon: <LayoutGrid size={20} /> },
    { path: '/monitor', label: 'Monitor', icon: <LineChart size={20} /> },
    { path: '/history', label: 'History', icon: <History size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} /> }
  ];

  return (
    <nav style={{ 
      height: 'calc(100vh - 64px)', 
      overflowY: 'auto'
    }}>
      <ul style={{ 
        listStyle: 'none', 
        padding: '0', 
        margin: 0 
      }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '48px',
                  padding: '0',
                  backgroundColor: isActive ? '#eff6ff' : 'transparent',
                  color: isActive ? '#2563eb' : '#4b5563',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s, color 0.2s',
                  position: 'relative'
                }}
              >
                <div style={{ 
                  width: '72px',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'absolute',
                  left: '0'
                }}>
                  {item.icon}
                </div>
                {isOpen && (
                  <div style={{ 
                    paddingLeft: '72px',
                    fontSize: '14px', 
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}>
                    {item.label}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
} 