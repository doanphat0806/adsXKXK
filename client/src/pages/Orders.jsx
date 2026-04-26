import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';

const ORDER_FETCH_LIMIT = 2000;
const DEFAULT_ORDERS_PER_PAGE = 100;

function daysAgoString(days) {
  const vnDate = new Date(Date.now() + 7 * 60 * 60 * 1000);
  vnDate.setUTCDate(vnDate.getUTCDate() - days);
  return vnDate.toISOString().split('T')[0];
}

const statusMap = {
  'new': 'Mới',
  'wait_for_confirm': 'Chờ xác nhận',
  'confirmed': 'Đã xác nhận',
  'picking': 'Đang lấy hàng',
  'delivering': 'Đang giao',
  'delivered': 'Đã giao',
  'success': 'Thành công',
  'returned': 'Hoàn trả',
  'cancelled': 'Đã hủy',
  'wait_for_pay': 'Chờ thanh toán',
  'paid': 'Đã thanh toán',
  'completed': 'Hoàn thành'
};

const toText = (value, fallback = 'â€”') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const getOrderItems = (raw) => (
  [raw.items, raw.line_items, raw.products, raw.details].find(Array.isArray) || []
);

export default function Orders() {
  const [allOrderRows, setAllOrderRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  
  // Sync dates
  const [syncFromDate, setSyncFromDate] = useState(() => daysAgoString(7));
  const [syncToDate, setSyncToDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(DEFAULT_ORDERS_PER_PAGE);

  const loadOrders = async (shouldSync = false) => {
    setLoading(true);
    setError(null);
    try {
      if (shouldSync) {
        toast.info('Đang đồng bộ từ Pancake...');
        const sfDate = syncFromDate || daysAgoString(7);
        await api('POST', '/orders/sync', { fromDate: sfDate, toDate: syncToDate });
        toast.success('Đồng bộ thành công');
      }

      // Fetch from DB
      let url = `/orders?limit=${ORDER_FETCH_LIMIT}`;
      if (syncFromDate) url += `&fromDate=${syncFromDate}`;
      if (syncToDate) url += `&toDate=${syncToDate}`;
      
      const orders = await api('GET', url);
      
      const rows = [];
      orders.forEach(o => {
        const dateStr = new Date(o.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const raw = asObject(o.rawData);
        raw.status_name = toText(raw.status_name ?? raw.status ?? o.status, 'Moi');
        const rawStatus = (raw.status_name || raw.status || o.status || 'Mới').toLowerCase();
        const posStatus = statusMap[rawStatus] || raw.status_name || raw.status || o.status || 'Mới';
        const isSuccess = ['success', 'hoàn thành', 'delivered', 'thành công', 'completed'].some(k => rawStatus.includes(k));
        const statusClass = isSuccess ? 'active' : 'paused';

        let tagsStr = '—';
        if (Array.isArray(raw.tags)) {
          tagsStr = raw.tags.map(t => typeof t === 'object' ? (t.name || t.text || t.value) : t).join(', ');
        } else if (typeof raw.tags === 'string') {
          tagsStr = toText(raw.tags);
        }

        const items = getOrderItems(raw);
        
        if (!items.length) {
          rows.push({ 
            rawDate: new Date(o.createdAt), 
            dateStr, 
            orderId: o.orderId,
            code: '—', 
            name: '—', 
            qty: '—', 
            posStatus, 
            size: '—', 
            tagsStr, 
            statusClass 
          });
          return;
        }

        items.forEach(i => {
          const vInfo = asObject(i.variation_info);
          const code = vInfo.product_display_id || vInfo.display_id || i.sku || i.item_code || '—';
          const name = vInfo.name || i.name || i.product_name || '—';
          const qty = i.quantity || i.amount || 1;
          
          let size = '—';
          if (Array.isArray(vInfo.fields)) {
            const sizeField = vInfo.fields.find(f => f.name && f.name.toUpperCase().includes('SIZE'));
            if (sizeField) size = sizeField.value;
          }
          if (size === '—' && vInfo.detail) {
            size = vInfo.detail.replace(/size:?\s*/i, '').trim() || vInfo.detail;
          }
          if (size === '—') {
            size = i.variation_value || i.size || '—';
          }

          rows.push({ 
            rawDate: new Date(o.createdAt), 
            dateStr, 
            orderId: o.orderId,
            code: toText(code), 
            name: toText(name), 
            qty, 
            posStatus: toText(posStatus), 
            size: toText(size), 
            tagsStr: toText(tagsStr), 
            statusClass 
          });
        });
      });
      setAllOrderRows(rows);
      setCurrentPage(1);
    } catch (e) {
      setError(e.message);
      toast.error('Lỗi: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(false); // Only fetch from DB on mount, no auto-sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    let res = allOrderRows;
    if (filterFromDate) {
      const fd = new Date(filterFromDate); fd.setHours(0,0,0,0);
      res = res.filter(r => r.rawDate >= fd);
    }
    if (filterToDate) {
      const td = new Date(filterToDate); td.setHours(23,59,59,999);
      res = res.filter(r => r.rawDate <= td);
    }
    return res;
  }, [allOrderRows, filterFromDate, filterToDate]);

  const totalPages = Math.ceil(filteredRows.length / ordersPerPage) || 1;
  const pageRows = filteredRows.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [ordersPerPage, filterFromDate, filterToDate]);

  return (
    <div id="page-orders">
      <div className="card section-gap">
        <div className="card-header">
          <div className="card-title">Đồng bộ từ Pancake (POS)</div>
          <button className="btn btn-g btn-sm" onClick={() => loadOrders(true)} disabled={loading}>
            {loading ? 'Đang đồng bộ...' : 'Đồng bộ lại'}
          </button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="form-group">
              <label>Lấy dữ liệu từ ngày</label>
              <input type="date" value={syncFromDate} onChange={e => setSyncFromDate(e.target.value)} />
              <div className="inline-note">Khuyên dùng để giảm tải khi có nhiều đơn</div>
            </div>
            <div className="form-group">
              <label>Đến ngày</label>
              <input type="date" value={syncToDate} onChange={e => setSyncToDate(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            Chi tiết đơn hàng (<span id="orderCount">{filteredRows.length} dòng</span>)
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted2)' }}>Lọc hiển thị:</span>
            <input 
              type="date" 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '4px 8px' }} 
              value={filterFromDate}
              onChange={e => setFilterFromDate(e.target.value)}
            />
            <span style={{ fontSize: '11px', color: 'var(--muted2)' }}>đến</span>
            <input 
              type="date" 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '4px 8px' }}
              value={filterToDate}
              onChange={e => setFilterToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="tbl-wrap">
          {loading ? (
             <div className="empty">
               <span className="spin">⟳</span><p style={{ marginTop: '10px' }}>Đang đồng bộ dữ liệu...</p>
             </div>
          ) : error ? (
            <div className="empty"><p style={{ color: 'var(--r)' }}>Lỗi: {error}</p></div>
          ) : filteredRows.length === 0 ? (
            <div className="empty">
              <div className="ei">🛒</div><p>Chưa có đơn hàng nào</p>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ngày tạo</th>
                  <th>Mã đơn</th>
                  <th>Mã SP</th>
                  <th>Tên SP</th>
                  <th>SL</th>
                  <th>Trạng thái</th>
                  <th>Size</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} style={{ verticalAlign: 'top' }}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.dateStr}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 'bold' }}>{r.orderId}</td>
                    <td style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>{r.code}</td>
                    <td>{r.name}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{r.qty}</td>
                    <td><span className={`badge ${r.statusClass}`}>{r.posStatus}</span></td>
                    <td style={{ fontWeight: 600 }}>{r.size}</td>
                    <td><span style={{ fontSize: '11px', background: 'var(--s2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--txt)' }}>{r.tagsStr}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredRows.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--s1)', borderTop: '1px solid var(--border)' }}>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '4px 8px', fontWeight: 'bold' }} 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage <= 1}
            >&lt;</button>
            <div style={{ border: '1px solid #1890ff', color: '#1890ff', padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', background: 'rgba(24, 144, 255, 0.1)' }}>
              {currentPage} / {totalPages}
            </div>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '4px 8px', fontWeight: 'bold' }} 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage >= totalPages}
            >&gt;</button>
            
            <select 
              className="form-control" 
              style={{ width: 'auto', height: '32px', fontSize: '13px', marginLeft: '10px', background: 'var(--s3)', color: 'var(--txt)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0 8px' }} 
              value={ordersPerPage}
              onChange={e => setOrdersPerPage(Number(e.target.value))}
            >
                <option value="100">100 / trang</option>
                <option value="500">500 / trang</option>
                <option value="1000">1000 / trang</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
