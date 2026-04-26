import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const emptyFormData = {
  name: '',
  fbToken: '',
  adAccountId: '',
  claudeKey: '',
  spendThreshold: 20000,
  checkInterval: 60,
  autoEnabled: false
};

const autofillTrapStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none'
};

const isValidAdAccountId = (value) => /^(act_)?\d+$/.test(String(value || '').trim());

export default function AccountModal({ data }) {
  const { closeModal, loadAccounts, appConfig } = useAppContext();
  const [formData, setFormData] = useState(emptyFormData);

  const isEdit = !!data;

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name || '',
        fbToken: '', // Don't show token
        adAccountId: data.adAccountId || '',
        claudeKey: '', // Don't show key
        spendThreshold: data.spendThreshold || 20000,
        checkInterval: data.checkInterval || 60,
        autoEnabled: data.autoEnabled || false
      });
    } else {
      setFormData(emptyFormData);
    }
  }, [data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        adAccountId: formData.adAccountId.trim(),
        fbToken: formData.fbToken.trim(),
        claudeKey: formData.claudeKey.trim()
      };

      if (!isValidAdAccountId(payload.adAccountId)) {
        toast.error('Ad Account ID phải là số hoặc dạng act_123456789');
        return;
      }

      if (!payload.fbToken) delete payload.fbToken;
      if (!payload.claudeKey) delete payload.claudeKey;

      if (isEdit) {
        await api('PUT', `/accounts/${data._id}`, payload);
        toast.success('Đã cập nhật tài khoản');
      } else {
        await api('POST', '/accounts', payload);
        toast.success('Đã thêm tài khoản');
      }
      loadAccounts();
      closeModal();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    }
  };

  return (
    <div className="card" style={{ border: 'none', margin: 0 }}>
      <div className="card-header">
        <div className="card-title">{isEdit ? '✏️ Sửa tài khoản' : '➕ Thêm tài khoản mới'}</div>
        <button className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
      </div>
      <form onSubmit={handleSubmit} autoComplete="off" style={{ padding: '20px' }}>
        <input name="username" type="text" autoComplete="username" tabIndex="-1" aria-hidden="true" style={autofillTrapStyle} />
        <input name="password" type="password" autoComplete="new-password" tabIndex="-1" aria-hidden="true" style={autofillTrapStyle} />
        <div className="form-group">
          <label>Tên gợi nhớ</label>
          <input 
            type="text" 
            name="account-label"
            autoComplete="off"
            required 
            value={formData.name} 
            onChange={e => setFormData({ ...formData, name: e.target.value })} 
            placeholder="Ví dụ: TK No Limit 01"
          />
        </div>
        <div className="form-group">
          <label>Facebook Access Token</label>
          <input 
            type="password" 
            name="facebook-access-token-new"
            autoComplete="new-password"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            value={formData.fbToken} 
            onChange={e => setFormData({ ...formData, fbToken: e.target.value })} 
            placeholder={isEdit ? "Để trống nếu không đổi" : "EAAxxxxxxxxxx..."}
          />
          <div className="inline-note">
            {appConfig.hasFbToken ? 'Đã có token dùng chung, có thể bỏ trống' : 'Bắt buộc nếu chưa có token dùng chung'}
          </div>
        </div>
        <div className="form-group">
          <label>Ad Account ID (act_xxxxxxxx)</label>
          <input 
            type="text" 
            name="facebook-ad-account-id"
            autoComplete="off"
            inputMode="numeric"
            pattern="^(act_)?[0-9]+$"
            title="Nhap so ID tai khoan quang cao hoac dang act_123456789"
            required 
            value={formData.adAccountId} 
            onChange={e => setFormData({ ...formData, adAccountId: e.target.value })} 
            placeholder="act_123456789"
          />
        </div>
        <div className="form-group">
          <label>Claude API Key (Tùy chọn)</label>
          <input 
            type="password" 
            name="claude-api-key-new"
            autoComplete="new-password"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            value={formData.claudeKey} 
            onChange={e => setFormData({ ...formData, claudeKey: e.target.value })} 
            placeholder={isEdit ? "Để trống nếu không đổi" : "sk-ant-api03-..."}
          />
        </div>
        
        {!isEdit && (
          <div style={{ padding: '12px', background: 'var(--s2)', borderRadius: 'var(--radius)', marginBottom: '15px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>Cài đặt tự động ban đầu</div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Thời gian check (s)</label>
                <input 
                  type="number" 
                  value={formData.checkInterval} 
                  onChange={e => setFormData({ ...formData, checkInterval: parseInt(e.target.value) })} 
                />
              </div>
              <div className="toggle-wrap" style={{ marginTop: '25px' }}>
                <label className="tgl">
                  <input 
                    type="checkbox" 
                    checked={formData.autoEnabled} 
                    onChange={e => setFormData({ ...formData, autoEnabled: e.target.checked })} 
                  />
                  <div className="tgl-track"></div>
                  <div className="tgl-thumb"></div>
                </label>
                <span>Bật tự động</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Hủy</button>
          <button type="submit" className="btn btn-p">{isEdit ? 'Lưu thay đổi' : 'Thêm tài khoản'}</button>
        </div>
      </form>
    </div>
  );
}
