import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { api, formatVND, formatNumber, todayString } from '../lib/api';
import { toast } from 'react-toastify';

export default function Campaigns() {
  const { allAccounts } = useAppContext();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [filterAcc, setFilterAcc] = useState('');
  const [filterDate, setFilterDate] = useState(todayString());
  const [filterStatus, setFilterStatus] = useState('');

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      let url;
      if (filterAcc) {
        url = `/accounts/${filterAcc}/campaigns?date=${filterDate}`;
      } else {
        url = `/campaigns/today?date=${filterDate}`;
      }
      const data = await api('GET', url);
      setCampaigns(data);
    } catch (e) {
      toast.error('Lỗi tải chiến dịch: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [filterAcc, filterDate]);

  const toggleCampaignStatus = async (campaignId, accountId, currentStatus) => {
    try {
      await api('POST', `/campaigns/${campaignId}/toggle`, { accountId, currentStatus, date: filterDate });
      toast.success(currentStatus === 'ACTIVE' ? 'Đã tạm dừng' : 'Đã bật');
      loadCampaigns();
    } catch (e) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (filterStatus) {
      result = result.filter(c => {
        const normalized = (c.status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
        return normalized === filterStatus;
      });
    }
    return [...result].sort((a, b) => b.spend - a.spend);
  }, [campaigns, filterStatus]);

  const stats = useMemo(() => {
    const activeCamps = filteredCampaigns.filter(c => (c.status||'').toUpperCase() === 'ACTIVE').length;
    const accSet = new Set(filteredCampaigns.map(c => c.accountId?._id || c.accountId));
    const spend = filteredCampaigns.reduce((s, c) => s + c.spend, 0);
    const msgs = filteredCampaigns.reduce((s, c) => s + c.messages, 0);
    return {
      activeCamps,
      accCount: accSet.size,
      spend,
      msgs
    };
  }, [filteredCampaigns]);

  return (
    <div id="page-campaigns">
      <div className="filter-row" style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <select 
          value={filterAcc} 
          onChange={e => setFilterAcc(e.target.value)}
          style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--txt)', padding: '6px 12px', borderRadius: '8px', outline: 'none' }}
        >
          <option value="">Tất cả tài khoản</option>
          {allAccounts.map(acc => (
            <option key={acc._id} value={acc._id}>{acc.name}</option>
          ))}
        </select>
        <input 
          type="date" 
          value={filterDate} 
          onChange={e => setFilterDate(e.target.value)}
          style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--txt)', padding: '6px 12px', borderRadius: '8px', outline: 'none' }}
        />
        <select 
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value)}
          style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--txt)', padding: '6px 12px', borderRadius: '8px', outline: 'none' }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang chạy</option>
          <option value="PAUSED">Tạm dừng</option>
        </select>
      </div>

      <div className="card section-gap">
        <div className="card-header">
          <div className="card-title">Báo cáo chiến dịch</div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted2)' }}>Chọn bộ lọc để xem báo cáo</span>
        </div>
        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
          <div className="acc-metric">
            <div className="acc-metric-label">Số camp</div>
            <div className="acc-metric-val">{stats.activeCamps}</div>
          </div>
          <div className="acc-metric">
            <div className="acc-metric-label">Số tài khoản</div>
            <div className="acc-metric-val">{stats.accCount}</div>
          </div>
          <div className="acc-metric">
            <div className="acc-metric-label">Chi tiêu</div>
            <div className="acc-metric-val" style={{ color: 'var(--o)' }}>{formatVND(stats.spend)}</div>
          </div>
          <div className="acc-metric">
            <div className="acc-metric-label">Tin nhắn</div>
            <div className="acc-metric-val" style={{ color: 'var(--p)' }}>{formatNumber(stats.msgs)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Danh sách chiến dịch</div>
          <button className="btn btn-ghost btn-sm" onClick={loadCampaigns}>↺</button>
        </div>
        <div className="tbl-wrap">
          {loading ? (
             <div className="empty">
               <span className="spin">⟳</span><p style={{ marginTop: '10px' }}>Đang tải...</p>
             </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="empty">
              <div className="ei">📢</div><p>Chưa có dữ liệu</p>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{width: '240px'}}>Tên Campaign</th>
                  <th>Trạng thái</th>
                  <th>Ngân sách</th>
                  <th style={{width: '180px'}}>Chi tiêu</th>
                  <th className="text-right">Tin nhắn</th>
                  <th className="text-right">Chi phí/TN</th>
                  <th className="text-right">Clicks</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c, i) => {
                  const statusNormalized = (c.status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
                  const budgetAmount = c.budgetType === 'LIFETIME' ? c.lifetimeBudget : c.dailyBudget;
                  const pct = Math.min(100, (c.spend / 30000) * 100);
                  const pColor = pct >= 100 ? 'var(--r)' : pct >= 70 ? 'var(--o)' : 'var(--g)';

                  return (
                    <tr key={i}>
                      <td>
                        <div style={{fontWeight: 600, marginBottom: '2px'}}>{c.name}</div>
                        <div style={{fontSize: '11px', color: 'var(--muted2)'}}>{c.campaignId}</div>
                      </td>
                      <td>
                        <span className={`badge ${statusNormalized.toLowerCase()}`}>
                          {statusNormalized === 'ACTIVE' ? '● Active' : '■ Paused'}
                        </span>
                      </td>
                      <td>
                        {budgetAmount > 0 ? (
                          <>
                            <div style={{fontSize: '12px', fontWeight: 600}}>{formatVND(budgetAmount)}</div>
                            <div style={{fontSize: '10px', color: 'var(--muted2)'}}>({c.budgetType === 'LIFETIME' ? 'Trọn đời' : 'Hàng ngày'})</div>
                          </>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="spend-col">
                          <div className="pbar"><div className="pbar-fill" style={{ width: `${pct}%`, background: pColor }}></div></div>
                          <span className="mono-sm" style={{color: pColor}}>{formatVND(c.spend)}</span>
                        </div>
                      </td>
                      <td className="text-right" style={{color: 'var(--p)', fontFamily: 'var(--mono)'}}>{formatNumber(c.messages)}</td>
                      <td className="text-right" style={{color: 'var(--g2)', fontFamily: 'var(--mono)'}}>
                        {c.messages > 0 ? formatVND(c.spend / c.messages) : '—'}
                      </td>
                      <td className="text-right mono-sm" style={{color: 'var(--muted2)'}}>{formatNumber(c.clicks || 0)}</td>
                      <td>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => toggleCampaignStatus(c.campaignId, c.accountId?._id || c.accountId, statusNormalized)}
                        >
                          {statusNormalized === 'ACTIVE' ? '⏸' : '▶'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
