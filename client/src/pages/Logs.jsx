import React, { useState, useEffect, useCallback } from 'react';
import { api, timeString } from '../lib/api';
import { toast } from 'react-toastify';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('GET', '/logs?limit=200');
      setLogs(data);
    } catch (e) {
      toast.error('Lỗi tải nhật ký');
    }
    setLoading(false);
  }, []);

  const clearLogs = async () => {
    if (!confirm('Xóa tất cả nhật ký?')) return;
    try {
      await api('DELETE', '/logs');
      setLogs([]);
      toast.success('Đã xóa nhật ký');
    } catch (e) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000); // Tải lại mỗi 30s
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const getLevelClass = (level) => {
    switch (level) {
      case 'error': return 'text-danger';
      case 'warn': return 'text-warning';
      case 'success': return 'text-success';
      case 'ai': return 'text-primary';
      default: return '';
    }
  };

  return (
    <div id="page-logs">
      <div className="filter-row" style={{ display: 'flex', gap: '10px', marginBottom: '14px', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={fetchLogs}>↺ Làm mới</button>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--r)' }} onClick={clearLogs}>🗑 Xóa tất cả</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Nhật ký hệ thống ({logs.length})</div>
        </div>
        <div className="tbl-wrap">
          {loading && logs.length === 0 ? (
            <div className="empty"><span className="spin">⟳</span><p>Đang tải...</p></div>
          ) : logs.length === 0 ? (
            <div className="empty"><div className="ei">📋</div><p>Chưa có nhật ký nào</p></div>
          ) : (
            <table className="tbl" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Thời gian</th>
                  <th style={{ width: '180px' }}>Tài khoản</th>
                  <th style={{ width: '80px' }}>Mức độ</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{timeString(log.createdAt)}</td>
                    <td style={{ fontWeight: 600 }}>{log.accountName || 'System'}</td>
                    <td>
                      <span className={`badge-mini ${log.level}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className={getLevelClass(log.level)} style={{ wordBreak: 'break-word' }}>
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
