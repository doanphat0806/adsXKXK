import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { formatVND, formatNumber, todayString, api, cachedApi, readResponseCache } from '../lib/api';
import DateRangePicker from '../components/DateRangePicker';
import { toast } from 'react-toastify';

const toText = (value, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

// Helper hiện mũi tên sort
const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
  return <span style={{ marginLeft: '4px', color: 'var(--b)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(2).replace('.', ',')}%`;
const DASHBOARD_CAMPAIGNS_PER_PAGE = 100;

export default function Dashboard() {
  const { provider, stats: globalStats, loading: globalLoading } = useAppContext();
  const showOrders = provider !== 'shopee';

  // Sort state cho bảng
  const [sortField, setSortField] = useState('spend'); // mặc định sort theo chi tiêu
  const [sortDir, setSortDir] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Date filter cho toàn Dashboard — mặc định hôm nay
  const [reportFromDate, setReportFromDate] = useState(() => todayString());
  const [reportToDate, setReportToDate] = useState(() => todayString());
  const [localStats, setLocalStats] = useState({});
  const [localCampaigns, setLocalCampaigns] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [skuCounts, setSkuCounts] = useState({});
  const [skuTotal, setSkuTotal] = useState(0);
  const [returnStatsBySku, setReturnStatsBySku] = useState({});
  const [orderReturnStats, setOrderReturnStats] = useState({
    returned: 0,
    returning: 0,
    received: 0,
    denominator: 0,
    rate: 0
  });
  const [skuLoading, setSkuLoading] = useState(false);
  const [togglingCampaignId, setTogglingCampaignId] = useState('');

  // Load stats & campaigns theo ngày được chọn
  const loadDashboardData = useCallback(async (from, to) => {
    setStatsLoading(true);
    try {
      const statsUrl = `/stats?provider=${provider}&fromDate=${from}&toDate=${to}`;
      const campaignsUrl = `/campaigns/today?provider=${provider}&fromDate=${from}&toDate=${to}`;
      const cachedStats = readResponseCache(`GET:${statsUrl}`);
      const cachedCampaigns = readResponseCache(`GET:${campaignsUrl}`);
      if (cachedStats) setLocalStats(cachedStats);
      if (cachedCampaigns) setLocalCampaigns(cachedCampaigns);
      if (cachedStats && cachedCampaigns) setStatsLoading(false);

      const [sData, cData] = await Promise.all([
        cachedApi('GET', statsUrl),
        cachedApi('GET', campaignsUrl, null, { timeoutMs: 5 * 60 * 1000 })
      ]);
      setLocalStats(sData);
      setLocalCampaigns(cData);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setStatsLoading(false);
    }
  }, [provider]);

  const toggleCampaignStatus = async (campaign) => {
    const accountId = campaign.accountId?._id || campaign.accountId;
    if (!campaign.campaignId || !accountId || togglingCampaignId) return;

    setTogglingCampaignId(campaign.campaignId);
    try {
      await api('POST', `/campaigns/${campaign.campaignId}/toggle`, {
        accountId,
        currentStatus: campaign.status,
        date: reportFromDate
      });
      toast.success(String(campaign.status || '').toUpperCase() === 'ACTIVE' ? 'Đã tắt camp' : 'Đã bật camp');
      await loadDashboardData(reportFromDate, reportToDate);
    } catch (error) {
      toast.error('Lỗi đổi trạng thái camp: ' + error.message);
    } finally {
      setTogglingCampaignId('');
    }
  };

  // Load SKU counts theo ngày được chọn
  const loadSkuCounts = useCallback(async (from, to) => {
    if (!from || !to || provider === 'shopee') return;
    setSkuLoading(true);
    try {
      const data = await api('GET', `/orders/sku-counts?fromDate=${from}&toDate=${to}`);
      setSkuCounts(data.counts || {});
      setSkuTotal(data.totalOrders || 0);
      setReturnStatsBySku(data.returnStatsBySku || {});
      setOrderReturnStats(data.returnStats || {
        returned: 0,
        returning: 0,
        received: 0,
        denominator: 0,
        rate: 0
      });
    } catch {
      setSkuCounts({});
      setSkuTotal(0);
      setReturnStatsBySku({});
      setOrderReturnStats({
        returned: 0,
        returning: 0,
        received: 0,
        denominator: 0,
        rate: 0
      });
    } finally {
      setSkuLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    loadDashboardData(reportFromDate, reportToDate);
    loadSkuCounts(reportFromDate, reportToDate);
  }, [reportFromDate, reportToDate, loadDashboardData, loadSkuCounts]);

  // "MS" + tên camp = mã SP trong sheet
  // vd: camp "PH1503345" → tìm SKU "MSPH1503345" trong skuCounts
  const getOrderCountForCampaign = useCallback((campaignName) => {
    if (!campaignName || !skuCounts || Object.keys(skuCounts).length === 0) return 0;
    const normName = String(campaignName).toUpperCase().replace(/\s+/g, '').trim();
    if (!normName) return 0;
    const expectedSku = 'MS' + normName;
    return Number(skuCounts[expectedSku] || 0);
  }, [skuCounts]);

  const getReturnStatsForCampaign = useCallback((campaignName) => {
    if (!campaignName || !returnStatsBySku || Object.keys(returnStatsBySku).length === 0) {
      return { returned: 0, returning: 0, received: 0, denominator: 0, rate: 0 };
    }
    const normName = String(campaignName).toUpperCase().replace(/\s+/g, '').trim();
    if (!normName) return { returned: 0, returning: 0, received: 0, denominator: 0, rate: 0 };
    const expectedSku = 'MS' + normName;
    return returnStatsBySku[expectedSku] || { returned: 0, returning: 0, received: 0, denominator: 0, rate: 0 };
  }, [returnStatsBySku]);

  // Xử lý campaigns: thêm orderCount, CPO — sort theo sortField/sortDir
  const processedCampaigns = useMemo(() => {
    const mapped = localCampaigns
      .filter(c => c.spend > 0 && String(c.status || '').toUpperCase() === 'ACTIVE')
      .map(c => {
        const orderCount = showOrders ? getOrderCountForCampaign(c.name) : 0;
        const returnStats = showOrders ? getReturnStatsForCampaign(c.name) : { denominator: 0, rate: 0 };
        const costPerOrder = orderCount > 0 ? c.spend / orderCount : 0;
        const costPerMessage = c.messages > 0 ? c.spend / c.messages : 0;
        return { ...c, orderCount, returnStats, returnRate: returnStats.rate || 0, costPerOrder, costPerMessage };
      });

    return [...mapped].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'orderCount') return dir * ((a.orderCount || 0) - (b.orderCount || 0));
      if (sortField === 'costPerOrder') {
        // đơn = 0 thì luôn xuống cuối
        if (!a.orderCount && !b.orderCount) return 0;
        if (!a.orderCount) return 1;
        if (!b.orderCount) return -1;
        return dir * (a.costPerOrder - b.costPerOrder);
      }
      if (sortField === 'spend') return dir * (a.spend - b.spend);
      if (sortField === 'messages') return dir * (a.messages - b.messages);
      if (sortField === 'returnRate') {
        if (!a.returnStats?.denominator && !b.returnStats?.denominator) return 0;
        if (!a.returnStats?.denominator) return 1;
        if (!b.returnStats?.denominator) return -1;
        return dir * ((a.returnRate || 0) - (b.returnRate || 0));
      }
      // default: active trước, rồi spend
      const sA = String(a.status || '').toUpperCase() === 'ACTIVE' ? 1 : 0;
      const sB = String(b.status || '').toUpperCase() === 'ACTIVE' ? 1 : 0;
      if (sA !== sB) return sB - sA;
      return b.spend - a.spend;
    });
  }, [localCampaigns, getOrderCountForCampaign, getReturnStatsForCampaign, showOrders, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedCampaigns.length / DASHBOARD_CAMPAIGNS_PER_PAGE));
  const visibleCampaigns = useMemo(() => {
    const page = Math.min(currentPage, totalPages);
    const start = (page - 1) * DASHBOARD_CAMPAIGNS_PER_PAGE;
    return processedCampaigns.slice(start, start + DASHBOARD_CAMPAIGNS_PER_PAGE);
  }, [currentPage, processedCampaigns, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportFromDate, reportToDate, provider, sortField, sortDir]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Tổng CPO toàn bảng
  const dateLabel = useMemo(() => {
    if (reportFromDate === reportToDate) {
      return reportFromDate === todayString() ? 'hôm nay' : reportFromDate.split('-').reverse().join('/');
    }
    return `${reportFromDate.split('-').reverse().join('/')} ~ ${reportToDate.split('-').reverse().join('/')}`;
  }, [reportFromDate, reportToDate]);

  return (
    <div id="page-dashboard">
      {/* Stats tổng quan */}
      <div className="stats-grid section-gap">
        <div className="stat g">
          <div className="stat-label">Tài khoản</div>
          <div className="stat-value g" id="sAccounts">{localStats.totalAccounts ?? globalStats.totalAccounts ?? '—'}</div>
          <div className="stat-sub">{localStats.connectedAccounts ?? globalStats.connectedAccounts ?? 0} kết nối</div>
        </div>
        <div className="stat b">
          <div className="stat-label">Camp đang chạy</div>
          <div className="stat-value b" id="sActive">{localStats.activeCount ?? '—'}</div>
        </div>
        <div className="stat o">
          <div className="stat-label">Chi tiêu {dateLabel}</div>
          <div className="stat-value o" id="sSpend">{localStats.totalSpend ? formatVND(localStats.totalSpend) : '—'}</div>
        </div>
        <div className="stat p">
          <div className="stat-label">Tin nhắn {dateLabel}</div>
          <div className="stat-value p" id="sMessages">{localStats.totalMessages ? formatNumber(localStats.totalMessages) : '—'}</div>
          <div className="stat-sub">{localStats.avgCPM > 0 ? `CPM: ${formatVND(localStats.avgCPM)}` : '—'}</div>
        </div>
        {showOrders && (
          <div className="stat g2" style={{ borderColor: 'var(--g2)' }}>
            <div className="stat-label">Đơn hàng {dateLabel}</div>
            <div className="stat-value g2" id="sOrders" style={{ color: 'var(--g2)' }}>
              {skuLoading ? '...' : skuTotal}
            </div>
            <div className="stat-sub">Từ Google Sheet</div>
          </div>
        )}
        {showOrders && (
          <div className="stat r" style={{ borderColor: 'var(--r)' }}>
            <div className="stat-label">CPO {dateLabel}</div>
            <div className="stat-value" id="sCPO" style={{ color: 'var(--r)', fontSize: skuLoading ? '1.4rem' : undefined }}>
              {skuLoading
                ? '...'
                : (skuTotal > 0 && localStats.totalSpend > 0)
                  ? formatVND(localStats.totalSpend / skuTotal)
                  : '—'}
            </div>
            <div className="stat-sub">Chi tiêu / Đơn</div>
          </div>
        )}
        {showOrders && (
          <div className="stat return-rate">
            <div className="stat-label">Tỉ lệ hoàn {dateLabel}</div>
            <div className="stat-value" id="sReturnRate">
              {skuLoading
                ? '...'
                : orderReturnStats.denominator > 0
                  ? formatPercent(orderReturnStats.rate)
                  : ''}
            </div>
            <div className="stat-sub">
              {skuLoading
                ? 'Đang tải'
                : orderReturnStats.denominator > 0
                  ? `${formatNumber(orderReturnStats.returned + orderReturnStats.returning)} / ${formatNumber(orderReturnStats.denominator)}`
                  : ''}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="card-title" style={{ margin: 0 }}>Báo cáo chi tiết {dateLabel}</div>
            <DateRangePicker 
              fromDate={reportFromDate} 
              toDate={reportToDate} 
              onChange={(from, to) => {
                setReportFromDate(from);
                setReportToDate(to);
              }}
              centered={true}
            />
            {(skuLoading || statsLoading) && <span className="spin" style={{ fontSize: '14px' }}>⟳</span>}
          </div>
        </div>
        <div className="tbl-wrap" id="dashCampTable">
          {(globalLoading || statsLoading) ? (
            <div className="empty">
              <span className="spin">⟳</span>
              <p style={{ marginTop: '10px' }}>Đang tải...</p>
            </div>
          ) : processedCampaigns.length === 0 ? (
            <div className="empty">
              <div className="ei">📢</div>
              <p>Không có dữ liệu cho khoảng ngày này</p>
            </div>
          ) : (
            <table className="tbl excel-style">
              <thead>
                <tr>
                  <th>Tên Campaign</th>
                  <th className="text-center">Bật/Tắt</th>
                  <th>Tên TKQC</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('messages')}>
                    Tin nhắn (Giá/TN)<SortIcon field="messages" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {showOrders && (
                    <th className="text-center" style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('orderCount')}>
                      Tổng đơn<SortIcon field="orderCount" sortField={sortField} sortDir={sortDir} />
                    </th>
                  )}
                  {showOrders && (
                    <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('returnRate')}>
                      Tỉ lệ hoàn<SortIcon field="returnRate" sortField={sortField} sortDir={sortDir} />
                    </th>
                  )}
                  {showOrders && (
                    <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('costPerOrder')}>
                      CPO<SortIcon field="costPerOrder" sortField={sortField} sortDir={sortDir} />
                    </th>
                  )}
                  <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('spend')}>
                    Đã chi tiêu<SortIcon field="spend" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="text-right">Ngân sách</th>
                </tr>
              </thead>
              <tbody>

                {visibleCampaigns.map((c, i) => {
                  const isActive = String(c.status || '').toUpperCase() === 'ACTIVE';
                  let cpmColor = 'var(--g)';
                  if (c.costPerMessage > 30000) cpmColor = 'var(--r)';
                  else if (c.costPerMessage > 20000) cpmColor = 'var(--o)';

                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{toText(c.name)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted2)' }}>{c.campaignId}</div>
                      </td>
                      <td className="text-center">
                        <button
                          className={`btn btn-sm ${isActive ? 'btn-danger' : 'btn-g'}`}
                          onClick={() => toggleCampaignStatus(c)}
                          disabled={togglingCampaignId === c.campaignId}
                          title={isActive ? 'Tắt camp' : 'Bật camp'}
                          style={{ minWidth: '54px', height: '28px', padding: '0 10px' }}
                        >
                          {togglingCampaignId === c.campaignId ? '...' : (isActive ? 'Tắt' : 'Bật')}
                        </button>
                      </td>
                      <td style={{ fontWeight: 500 }}>{c.accountId?.name || '—'}</td>
                      <td className="text-center">
                        <span className={`badge ${isActive ? 'active' : 'paused'}`}>
                          {isActive ? 'ACTIVE' : 'PAUSE'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div style={{ fontWeight: 'bold', color: cpmColor }}>{formatVND(c.costPerMessage)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted2)' }}>{c.messages} TN</div>
                      </td>
                      {showOrders && (
                        <td className="text-center" style={{ fontWeight: 'bold', color: c.orderCount > 0 ? 'var(--g2)' : 'var(--muted2)' }}>
                          {c.orderCount || '—'}
                        </td>
                      )}
                      {showOrders && (
                        <td className="text-right" style={{ color: c.returnStats?.denominator > 0 ? 'var(--b)' : 'var(--muted2)' }}>
                          {c.returnStats?.denominator > 0 ? (
                            <>
                              <div style={{ fontWeight: 'bold' }}>{formatPercent(c.returnRate)}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted2)' }}>
                                {formatNumber((c.returnStats.returned || 0) + (c.returnStats.returning || 0))} / {formatNumber(c.returnStats.denominator)}
                              </div>
                            </>
                          ) : ''}
                        </td>
                      )}
                      {showOrders && (
                        <td className="text-right" style={{ color: c.costPerOrder > 0 ? 'var(--g2)' : 'var(--muted2)' }}>
                          {c.costPerOrder > 0 ? formatVND(c.costPerOrder) : '—'}
                        </td>
                      )}
                      <td className="text-right mono-sm">{formatVND(c.spend)}</td>
                      <td className="text-right mono-sm">{formatVND(c.dailyBudget || c.lifetimeBudget || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {processedCampaigns.length > DASHBOARD_CAMPAIGNS_PER_PAGE && (
          <div className="dashboard-pagination">
            <span>
              Hiển thị {(currentPage - 1) * DASHBOARD_CAMPAIGNS_PER_PAGE + 1}
              -{Math.min(currentPage * DASHBOARD_CAMPAIGNS_PER_PAGE, processedCampaigns.length)}
              / {processedCampaigns.length} camp
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>Đầu</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1}>Trước</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
              .map((page, index, pages) => (
                <React.Fragment key={page}>
                  {index > 0 && page - pages[index - 1] > 1 && <span className="dashboard-page-gap">...</span>}
                  <button
                    className={`btn btn-sm ${page === currentPage ? 'btn-g' : 'btn-ghost'}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                </React.Fragment>
              ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Sau</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Cuối</button>
          </div>
        )}
      </div>
    </div>
  );
}
