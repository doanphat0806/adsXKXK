import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

export default function AutomationModal({ data }) {
  const { closeModal, loadAccounts } = useAppContext();
  const [formData, setFormData] = useState({
    spendThreshold: 25000,
    checkInterval: 60
  });

  useEffect(() => {
    if (data) {
      setFormData({
        spendThreshold: data.spendThreshold || 25000,
        checkInterval: data.checkInterval || 60
      });
    }
  }, [data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api('PUT', `/accounts/${data._id}`, {
        spendThreshold: parseInt(formData.spendThreshold),
        checkInterval: parseInt(formData.checkInterval)
      });
      toast.success('Đã cập nhật cấu hình tự động');
      loadAccounts();
      closeModal();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    }
  };

  return (
    <div className="card" style={{ border: 'none', margin: 0 }}>
      <div className="card-header">
        <div className="card-title">⏱ Cài đặt Automation: {data?.name}</div>
        <button className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        <div className="form-group">
          <label>Ngưỡng chi tiêu & Tin nhắn</label>
          <input 
            type="text" 
            disabled 
            value="25k/0 tin nhan hoac 50k/20k moi tin nhan" 
            style={{ background: 'var(--s2)', cursor: 'not-allowed' }}
          />
          <div className="inline-note">Logic này hiện được cấu hình mặc định trong mã nguồn.</div>
        </div>
        
        <div className="form-group">
          <label>Chu kỳ kiểm tra (giây)</label>
          <input 
            type="number" 
            min="30" 
            max="3600"
            required
            value={formData.checkInterval} 
            onChange={e => setFormData({ ...formData, checkInterval: e.target.value })} 
          />
          <div className="inline-note">Khoảng cách giữa mỗi lần quét dữ liệu (30s - 3600s).</div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Hủy</button>
          <button type="submit" className="btn btn-p">Lưu cài đặt</button>
        </div>
      </form>
    </div>
  );
}
