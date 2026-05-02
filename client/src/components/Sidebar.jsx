import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';

export default function Sidebar() {
  const { stats, allAccounts, openModal, provider, logout } = useAppContext();
  const showOrders = provider !== 'shopee';

  return (
    <nav className="sidebar" id="sidebar">
      <div className="sidebar-logo">
        <h1>⚡ <span className="text">XekoXuka Shop</span></h1>
      </div>

      <div className="nav-section">Menu</div>

      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <span className="icon">📊</span><span>Dashboard</span>
      </NavLink>

      <NavLink to="/accounts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="icon">👤</span><span>Tài khoản</span>
        {allAccounts.length > 0 && (
          <span className="badge-mini" id="navAccBadge">{allAccounts.length}</span>
        )}
      </NavLink>
      
      <NavLink to="/create-campaign" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="icon">🚀</span><span>Lên Camp</span>
      </NavLink>

      <NavLink to="/campaigns" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="icon">📢</span><span>Chiến dịch</span>
      </NavLink>

      <NavLink to="/clone-campaigns" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="icon">⧉</span><span>Nhân Camp</span>
      </NavLink>

      {showOrders && (
        <NavLink to="/orders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="icon">🛒</span><span>Đơn hàng</span>
        </NavLink>
      )}


      <NavLink to="/logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="icon">📋</span><span>Nhật ký</span>
      </NavLink>

      <div className="nav-section">Hệ thống</div>

      <div className="nav-item" style={{ cursor: 'pointer' }} onClick={() => openModal('ACCOUNT')}>
        <span className="icon">➕</span><span>Thêm tài khoản</span>
      </div>

      <div className="nav-item" style={{ cursor: 'pointer' }} onClick={() => openModal('CONFIG')}>
        <span className="icon">⚙️</span><span>Cấu hình API</span>
      </div>

      <div className="sidebar-footer">
        <div style={{ padding: '0 12px 12px', borderBottom: '1px solid #ffffff10', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted2)', marginBottom: '5px' }}>Đang đăng nhập:</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>👤 {localStorage.getItem('adsctrl-username') || 'User'}</div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '10px', fontSize: '11px', padding: '4px' }} onClick={logout}>
            🚪 Đăng xuất
          </button>
        </div>
        <div className="global-status">
          <div className={`dot ${stats.connectedAccounts > 0 ? 'on' : ''}`} id="globalDot"></div>
          <span id="globalStatusTxt" style={{ fontSize: '11px', color: 'var(--muted2)' }}>
            {stats.connectedAccounts > 0 ? `${stats.connectedAccounts} online` : 'Offline'}
          </span>
        </div>
      </div>
    </nav>
  );
}
