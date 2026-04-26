import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { api } from '../lib/api';
import { toast } from 'react-toastify';

export default function Topbar({ title }) {
  const { logout, refreshAll, openModal } = useAppContext();

  const handleAutoDiscover = async () => {
    try {
      toast.info('Đang tìm kiếm tài khoản...');
      await api('POST', '/accounts/auto-discover');
      refreshAll();
    } catch (e) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  return (
    <div className="topbar">
      <div className="topbar-title">
        <span id="pageTitle">{title}</span>
      </div>
      <div className="topbar-actions">
        <span id="dateLabel" style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted2)' }}>
          {new Date().toLocaleDateString('vi-VN')}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => openModal('CONFIG')}>Token / API key</button>
        <button className="btn btn-ghost btn-sm" onClick={refreshAll}>↺ Làm mới</button>
        <button 
          className="btn btn-ghost btn-sm" 
          style={{ borderColor: 'var(--b)', color: 'var(--b)' }}
          onClick={handleAutoDiscover}
        >
          🔍 Auto Discover
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => openModal('BULK_ADD')}>+ Thêm nhiều</button>
        <button className="btn btn-g btn-sm" onClick={() => openModal('ACCOUNT')}>+ Thêm tài khoản</button>
        <button className="btn btn-danger btn-sm" onClick={logout}>Đăng xuất</button>
      </div>
    </div>
  );
}
