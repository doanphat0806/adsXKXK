import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { api, formatVND, formatNumber, timeString } from '../lib/api';
import { toast } from 'react-toastify';

export default function Accounts() {
  const { allAccounts, allTodayCampaigns, loadAccounts, openModal } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());

  const filteredAccounts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return allAccounts;
    return allAccounts.filter(acc => 
      acc.name.toLowerCase().includes(term)
    );
  }, [allAccounts, searchTerm]);

  const campaignStatsByAccount = useMemo(() => {
    const statsMap = new Map();
    for (const campaign of allTodayCampaigns) {
      const accountId = campaign.accountId?._id || campaign.accountId;
      if (!accountId) continue;
      const item = statsMap.get(accountId) || { spend: 0, msgs: 0, active: 0 };
      item.spend += campaign.spend || 0;
      item.msgs += campaign.messages || 0;
      if ((campaign.status || '').toUpperCase() === 'ACTIVE') item.active += 1;
      statsMap.set(accountId, item);
    }
    return statsMap;
  }, [allTodayCampaigns]);

  const handleSelect = (id, checked) => {
    const newSet = new Set(selectedAccounts);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedAccounts(newSet);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedAccounts(new Set(filteredAccounts.map(a => a._id)));
    } else {
      setSelectedAccounts(new Set());
    }
  };

  const toggleAuto = async (id, enabled) => {
    try {
      await api('POST', `/accounts/${id}/auto`, { enabled });
      toast.success(`Đã ${enabled ? 'bật' : 'tắt'} tự động cho tài khoản`);
      loadAccounts();
    } catch (e) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const deleteSelected = async () => {
    if (selectedAccounts.size === 0) return;
    if (!confirm(`Xóa ${selectedAccounts.size} tài khoản đã chọn?`)) return;
    try {
      await api('POST', '/accounts/delete-bulk', { ids: Array.from(selectedAccounts) });
      toast.success('Đã xóa thành công');
      setSelectedAccounts(new Set());
      loadAccounts();
    } catch (e) {
      toast.error('Lỗi xóa: ' + e.message);
    }
  };

  const toggleAutoBulk = async (enabled) => {
    if (selectedAccounts.size === 0) return;
    try {
      await api('POST', '/accounts/toggle-auto-bulk', { 
        ids: Array.from(selectedAccounts),
        enabled 
      });
      toast.success(`Đã ${enabled ? 'bật' : 'tắt'} tự động cho ${selectedAccounts.size} tài khoản`);
      loadAccounts();
    } catch (e) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const deleteAccount = async (id, name) => {
    if (!confirm(`Xóa tài khoản "${name}"?`)) return;
    try {
      await api('DELETE', `/accounts/${id}`);
      toast.success('Đã xóa tài khoản');
      loadAccounts();
    } catch (e) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  return (
    <div id="page-accounts">
      <div className="filter-row sticky-top" style={{ display: 'flex', gap: '10px', marginBottom: '14px', position: 'sticky', top: '0', background: 'var(--bg)', zIndex: '10', padding: '10px 0' }}>
        <input 
          type="text" 
          placeholder="🔍 Tìm theo tên tài khoản..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--txt)', padding: '8px 14px', borderRadius: '8px', outline: 'none', width: '300px' }}
        />
        <button className="btn btn-ghost" onClick={() => loadAccounts()}>↺ Làm mới</button>
      </div>

      {filteredAccounts.length > 0 && (
        <div className={`bulk-bar ${selectedAccounts.size > 0 ? 'show' : ''}`} style={{ display: selectedAccounts.size > 0 ? 'flex' : 'none', position: 'sticky', top: '54px', zIndex: '9', background: 'var(--s1)', marginBottom: '14px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <input 
            type="checkbox" 
            style={{ width: '16px', height: '16px', accentColor: 'var(--g)' }} 
            checked={selectedAccounts.size === filteredAccounts.length}
            onChange={e => handleSelectAll(e.target.checked)}
          />
          <span className="bulk-count">Đã chọn {selectedAccounts.size}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm" style={{ background: 'var(--g)', color: '#fff' }} onClick={() => toggleAutoBulk(true)}>Bật Auto</button>
            <button className="btn btn-sm" style={{ background: 'var(--o)', color: '#fff' }} onClick={() => toggleAutoBulk(false)}>Tắt Auto</button>
            <button className="btn btn-danger btn-sm" onClick={deleteSelected}>Xóa tài khoản</button>
          </div>
        </div>
      )}

      <div className="accounts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {filteredAccounts.length === 0 ? (
          <div className="empty" style={{ gridColumn: '1 / -1' }}>
            <div className="ei">🔍</div><p>Không tìm thấy tài khoản</p>
          </div>
        ) : (
          filteredAccounts.map(acc => {
            const accountStats = campaignStatsByAccount.get(acc._id) || { spend: 0, msgs: 0, active: 0 };
            const spend = accountStats.spend;
            const msgs = accountStats.msgs;
            const cpm = msgs > 0 ? spend / msgs : 0;
            const active = accountStats.active;
            const lastChecked = acc.lastChecked ? timeString(acc.lastChecked) : '—';
            const isChecked = selectedAccounts.has(acc._id);

            return (
              <div 
                key={acc._id} 
                className={`acc-card ${acc.autoEnabled ? 'auto-enabled' : ''} ${isChecked ? 'is-selected' : ''}`}
                onClick={() => handleSelect(acc._id, !isChecked)}
                style={{ cursor: 'pointer' }}
              >
                <label className="acc-select" aria-label="Chọn tài khoản" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={isChecked}
                    onChange={e => handleSelect(acc._id, e.target.checked)}
                  />
                  <span className="acc-select-box" aria-hidden="true"></span>
                </label>
                <div className="acc-card-top">
                  <div>
                    <div className="acc-name">{acc.name}</div>
                    <div className="acc-id">{acc.adAccountId}</div>
                  </div>
                  <div className={`acc-status ${acc.status}`}>
                    {acc.status === 'connected' ? '● Online' : acc.status === 'error' ? '✗ Lỗi' : '○ Offline'}
                  </div>
                </div>
                
                <div className="acc-metrics">
                  <div className="acc-metric">
                    <div className="acc-metric-label">Chi tiêu</div>
                    <div className="acc-metric-val" style={{color: 'var(--o)'}}>{formatVND(spend)}</div>
                  </div>
                  <div className="acc-metric">
                    <div className="acc-metric-label">Tin nhắn</div>
                    <div className="acc-metric-val" style={{color: 'var(--p)'}}>{formatNumber(msgs)}</div>
                  </div>
                  <div className="acc-metric">
                    <div className="acc-metric-label">Chi phí/TN</div>
                    <div className="acc-metric-val" style={{color: 'var(--g2)'}}>{cpm > 0 ? formatVND(cpm) : '—'}</div>
                  </div>
                </div>
                
                <div style={{fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: '10px'}}>
                  {active} camp đang chạy · cập nhật lúc {lastChecked}
                </div>
                
                <div className="acc-footer" onClick={e => e.stopPropagation()}>
                  <div className="toggle-wrap">
                    <label className="tgl" title="Tự động điều khiển">
                      <input 
                        type="checkbox" 
                        checked={acc.autoEnabled} 
                        onChange={e => toggleAuto(acc._id, e.target.checked)}
                      />
                      <div className="tgl-track"></div>
                      <div className="tgl-thumb"></div>
                    </label>
                    <span>Tự động</span>
                  </div>
                  <div className="acc-actions">
                    <button 
                      className="btn btn-ghost btn-sm btn-icon" 
                      title="Cấu hình Automation"
                      onClick={() => openModal('AUTOMATION', acc)}
                    >⏱</button>
                    <button 
                      className="btn btn-ghost btn-sm btn-icon" 
                      title="Sửa tài khoản"
                      onClick={() => openModal('ACCOUNT', acc)}
                    >✏️</button>
                    <button 
                      className="btn btn-ghost btn-sm btn-icon" 
                      style={{color: 'var(--r)', borderColor: 'rgba(244, 63, 94, 0.3)'}} 
                      title="Xóa tài khoản"
                      onClick={() => deleteAccount(acc._id, acc.name)}
                    >🗑</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
