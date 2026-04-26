import React, { useCallback, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { formatVND, formatNumber } from '../lib/api';

const toText = (value, fallback = 'â€”') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const normalizeText = (value) => toText(value, '').toUpperCase();

export default function Dashboard() {
  const { stats, allTodayCampaigns, todayOrderSkuCounts, loading } = useAppContext();

  // Extract SKU from campaign name (first word)
  const extractSKU = (name) => {
    if (!name) return '—';
    const firstWord = toText(name, '').split(/[\s-]+/).find(Boolean);
    // Simple heuristic: if it looks like a SKU (letters + numbers)
    if (!firstWord) return 'â€”';
    return firstWord.toUpperCase();
  };

  // Helper to count orders for a SKU
  const getOrderCountForSKU = useCallback((sku) => {
    if (sku === '—') return 0;
    const normalizedSku = normalizeText(sku);
    if (!normalizedSku || normalizedSku === normalizeText('Ã¢â‚¬â€')) return 0;
    return Object.entries(todayOrderSkuCounts || {}).reduce((sum, [itemSku, count]) => {
      return normalizeText(itemSku).includes(normalizedSku) ? sum + Number(count || 0) : sum;
    }, 0);
  }, [todayOrderSkuCounts]);

  // Process campaigns with calculated metrics for sorting
  const processedCampaigns = useMemo(() => {
    return allTodayCampaigns
      .filter(c => c.spend > 0)
      .map(c => {
        const sku = extractSKU(c.name);
        const orderCount = getOrderCountForSKU(sku);
        const costPerOrder = orderCount > 0 ? c.spend / orderCount : 0;
        return { ...c, sku, orderCount, costPerOrder };
      }).sort((a, b) => {
        const sA = normalizeText(a.status) === 'ACTIVE' ? 1 : 0;
        const sB = normalizeText(b.status) === 'ACTIVE' ? 1 : 0;
        if (sA !== sB) return sB - sA;
        return b.costPerOrder - a.costPerOrder;
      });
  }, [allTodayCampaigns, getOrderCountForSKU]);

  return (
    <div id="page-dashboard">
      <div className="stats-grid section-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat g">
          <div className="stat-label">Tài khoản</div>
          <div className="stat-value g" id="sAccounts">{stats.totalAccounts ?? '—'}</div>
          <div className="stat-sub" id="sAccountsSub">{stats.connectedAccounts ?? 0} kết nối</div>
        </div>
        <div className="stat b">
          <div className="stat-label">Camp đang chạy</div>
          <div className="stat-value b" id="sActive">{stats.activeCount ?? '—'}</div>
        </div>
        <div className="stat o">
          <div className="stat-label">Chi tiêu hôm nay</div>
          <div className="stat-value o" id="sSpend">{stats.totalSpend ? formatVND(stats.totalSpend) : '—'}</div>
        </div>
        <div className="stat p">
          <div className="stat-label">Tin nhắn hôm nay</div>
          <div className="stat-value p" id="sMessages">{stats.totalMessages ? formatNumber(stats.totalMessages) : '—'}</div>
          <div className="stat-sub" id="sCPM">
            {stats.avgCPM > 0 ? `CPM: ${formatVND(stats.avgCPM)}` : '—'}
          </div>
        </div>
        <div className="stat g2" style={{ borderColor: 'var(--g2)' }}>
          <div className="stat-label">Đơn hàng hôm nay</div>
          <div className="stat-value g2" id="sOrders" style={{ color: 'var(--g2)' }}>{stats.totalOrders ?? '—'}</div>
          <div className="stat-sub">Đồng bộ từ Pancake</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Báo cáo chi tiết hôm nay</div>
        </div>
        <div className="tbl-wrap" id="dashCampTable">
          {loading ? (
            <div className="empty">
              <span className="spin">⟳</span>
              <p style={{ marginTop: '10px' }}>Đang tải...</p>
            </div>
          ) : processedCampaigns.length === 0 ? (
            <div className="empty">
              <div className="ei">📢</div>
              <p>Không có campaign nào chạy hôm nay</p>
            </div>
          ) : (
            <table className="tbl excel-style">
              <thead>
                <tr>
                  <th>Mã sản phẩm</th>
                  <th>ID TKQC</th>
                  <th>TÊN TKQC</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-right">Tin nhắn (Giá/TN)</th>
                  <th className="text-center">Tổng đơn</th>
                  <th className="text-right">Phí/Đơn</th>
                  <th className="text-right">Đã chi tiêu</th>
                  <th className="text-right">Ngân sách</th>
                </tr>
              </thead>
              <tbody>
                {processedCampaigns.map((c, i) => {
                  const statusNormalized = normalizeText(c.status) === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
                  const costPerMessage = c.messages > 0 ? c.spend / c.messages : 0;

                  // Color coding for cost per message
                  let cpmColor = 'var(--g)'; // Green < 15k
                  if (costPerMessage > 30000) cpmColor = 'var(--r)'; // Red > 30k
                  else if (costPerMessage > 20000) cpmColor = 'var(--o)'; // Orange > 20k

                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 'bold', color: '#1890ff' }}>{c.sku}</td>
                      <td className="mono-sm" style={{ color: 'var(--muted)' }}>{c.accountId?.adAccountId || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{c.accountId?.name || '—'}</td>
                      <td className="text-center">
                        <span className={`badge ${statusNormalized.toLowerCase()}`}>
                          {statusNormalized === 'ACTIVE' ? 'ACTIVE' : 'PAUSE'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div style={{ fontWeight: 'bold', color: cpmColor }}>
                          {formatVND(costPerMessage)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted2)' }}>{c.messages} TN</div>
                      </td>
                      <td className="text-center" style={{ fontWeight: 'bold' }}>
                        {c.orderCount || '—'}
                      </td>
                      <td className="text-right" style={{ color: 'var(--g2)' }}>
                        {c.orderCount > 0 ? formatVND(c.costPerOrder) : '—'}
                      </td>
                      <td className="text-right mono-sm">
                        {formatVND(c.spend)}
                      </td>
                      <td className="text-right mono-sm">
                        {formatVND(c.dailyBudget || c.lifetimeBudget || 0)}
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
