import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', icon: '🏠', label: '首页' },
  { path: '/import', icon: '📷', label: '导入' },
  { path: '/analysis', icon: '📊', label: '分析' },
  { path: '/settings', icon: '⚙️', label: '设置' },
];

function BottomNav() {
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default BottomNav;
