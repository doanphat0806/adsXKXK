import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

export default function ConfigModal() {
  const { closeModal, appConfig, loadConfig, provider } = useAppContext();
  const isShopee = provider === 'shopee';
  
  const [fbToken, setFbToken] = useState('');
  const [fbApp, setFbApp] = useState({ id: '', secret: '' });
  const [claudeKey, setClaudeKey] = useState('');
  const [pancake, setPancake] = useState({ apiKey: '', shopId: '' });
  const [autoRules, setAutoRules] = useState({ start: '00:00', end: '08:30' });
  const [autoLimits, setAutoLimits] = useState({
    dailyZero: 25000, dailyHighCost: 20000, dailyHighSpend: 50000,
    lifetimeZero: 25000, lifetimeHighCost: 20000, lifetimeHighSpend: 50000,
    dailyClickLimit: 0, lifetimeClickLimit: 0,
    dailyCpcLimit: 500, lifetimeCpcLimit: 500
  });

  useEffect(() => {
    if (appConfig) {
      setFbApp({ id: appConfig.fbAppId || '', secret: '' });
      setPancake({ apiKey: '', shopId: appConfig.pancakeShopId || '' });
      setAutoRules({ 
        start: appConfig.autoRuleStartTime || '00:00', 
        end: appConfig.autoRuleEndTime || '08:30' 
      });
      // Populating limits from config if available
      setAutoLimits({
        dailyZero: appConfig.dailyZeroMessageSpendLimit || 25000,
        dailyHighCost: appConfig.dailyHighCostPerMessageLimit || 20000,
        dailyHighSpend: appConfig.dailyHighCostSpendLimit || 50000,
        lifetimeZero: appConfig.lifetimeZeroMessageSpendLimit || 25000,
        lifetimeHighCost: appConfig.lifetimeHighCostPerMessageLimit || 20000,
        lifetimeHighSpend: appConfig.lifetimeHighCostSpendLimit || 50000,
        dailyClickLimit: appConfig.dailyClickLimit || 0,
        lifetimeClickLimit: appConfig.lifetimeClickLimit || 0,
        dailyCpcLimit: appConfig.dailyCpcLimit || 500,
        lifetimeCpcLimit: appConfig.lifetimeCpcLimit || 500
      });
    }
  }, [appConfig]);

  const save = async (path, body, successMsg) => {
    try {
      await api('PUT', path, body);
      await loadConfig();
      toast.success(successMsg);
    } catch (e) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  return (
    <div className="card" style={{ border: 'none', margin: 0, width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
      <div className="card-header">
        <div className="card-title">⚙️ Cấu hình hệ thống</div>
        <button className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
      </div>
      <div style={{ padding: '20px' }}>
        
        {/* Section: Facebook Token */}
        <section className="section-gap">
          <div className="section-title">1. Facebook Access Token (Dùng chung)</div>
          <div className="form-group">
            <input 
              type="password" 
              placeholder={appConfig.hasFbToken ? "Đã lưu token (Nhập mới để ghi đè)" : "EAAxxxxxxxxxx..."}
              value={fbToken}
              onChange={e => setFbToken(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn btn-p btn-sm" onClick={() => save('/config', { fbToken }, 'Đã lưu FB Token')}>Lưu Token</button>
          </div>
        </section>

        {/* Section: FB App ID & Secret */}
        <section className="section-gap">
          <div className="section-title">2. Facebook App Credentials</div>
          <div className="form-grid">
            <div className="form-group">
              <label>App ID</label>
              <input type="text" value={fbApp.id} onChange={e => setFbApp({ ...fbApp, id: e.target.value })} />
            </div>
            <div className="form-group">
              <label>App Secret</label>
              <input type="password" placeholder="••••••••" value={fbApp.secret} onChange={e => setFbApp({ ...fbApp, secret: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn btn-p btn-sm" onClick={() => save('/config', { fbAppId: fbApp.id, fbAppSecret: fbApp.secret }, 'Đã lưu App ID & Secret')}>Lưu App</button>
          </div>
        </section>

        {/* Section: Claude AI */}
        <section className="section-gap">
          <div className="section-title">3. Claude AI API Key (Dùng chung)</div>
          <div className="form-group">
            <input 
              type="password" 
              placeholder={appConfig.hasClaudeKey ? "Đã lưu key (Nhập mới để ghi đè)" : "sk-ant-api03-..."}
              value={claudeKey}
              onChange={e => setClaudeKey(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn btn-p btn-sm" onClick={() => save('/config', { claudeKey }, 'Đã lưu Claude Key')}>Lưu API Key</button>
          </div>
        </section>

        {/* Section: Pancake */}
        <section className="section-gap">
          <div className="section-title">4. Pancake POS Integration</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Shop ID</label>
              <input type="text" value={pancake.shopId} onChange={e => setPancake({ ...pancake, shopId: e.target.value })} />
            </div>
            <div className="form-group">
              <label>API Key</label>
              <input type="password" placeholder="Nhập API Key mới" value={pancake.apiKey} onChange={e => setPancake({ ...pancake, apiKey: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn btn-p btn-sm" onClick={() => save('/config', { pancakeApiKey: pancake.apiKey, pancakeShopId: pancake.shopId }, 'Đã lưu cấu hình Pancake')}>Lưu Pancake</button>
          </div>
        </section>

        {/* Section: Auto Rules Time */}
        <section className="section-gap">
          <div className="section-title">5. Khung giờ chạy Auto Rules</div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-group">
              <label>Bắt đầu</label>
              <input type="time" value={autoRules.start} onChange={e => setAutoRules({ ...autoRules, start: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Kết thúc</label>
              <input type="time" value={autoRules.end} onChange={e => setAutoRules({ ...autoRules, end: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn btn-p btn-sm" onClick={() => save('/auto-rules', { startTime: autoRules.start, endTime: autoRules.end }, 'Đã lưu khung giờ')}>Lưu khung giờ</button>
          </div>
        </section>

        {/* Section: Auto Limits */}
        <section className="section-gap">
          <div className="section-title">6. Điều kiện tắt Campaign Tự động {isShopee ? '(Shopee)' : '(Facebook)'}</div>
          <div style={{ marginBottom: '12px', color: 'var(--muted2)' }}>
            {isShopee
              ? 'Shopee sẽ tắt chiến dịch dựa trên chi phí trên mỗi lượt click. Ngưỡng có thể điều chỉnh được.'
              : 'Facebook dùng chi phí tin nhắn và số tin nhắn để xác định khi nào tắt chiến dịch.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>THEO NGÀY</div>
              {isShopee ? (
                <>
                  <div className="form-group"><label>Chi phí tối đa/ click (ngày)</label><input type="number" min="0" placeholder="500" value={autoLimits.dailyCpcLimit} onChange={e => setAutoLimits({ ...autoLimits, dailyCpcLimit: e.target.value })} /></div>
                  <div className="form-group"><label>Số click tối đa/ngày</label><input type="number" min="0" placeholder="0" value={autoLimits.dailyClickLimit} onChange={e => setAutoLimits({ ...autoLimits, dailyClickLimit: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div className="form-group"><label>Chi tiêu tối đa khi 0-1 TN</label><input type="number" min="0" placeholder="25000" value={autoLimits.dailyZero} onChange={e => setAutoLimits({ ...autoLimits, dailyZero: e.target.value })} /></div>
                  <div className="form-group"><label>Giá TN tối đa</label><input type="number" min="0" placeholder="20000" value={autoLimits.dailyHighCost} onChange={e => setAutoLimits({ ...autoLimits, dailyHighCost: e.target.value })} /></div>
                  <div className="form-group"><label>Chi tiêu tối đa khi TN đắt</label><input type="number" min="0" placeholder="50000" value={autoLimits.dailyHighSpend} onChange={e => setAutoLimits({ ...autoLimits, dailyHighSpend: e.target.value })} /></div>
                </>
              )}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>TRỌN ĐỜI</div>
              {isShopee ? (
                <>
                  <div className="form-group"><label>Chi phí tối đa/ click (trọn đời)</label><input type="number" min="0" placeholder="500" value={autoLimits.lifetimeCpcLimit} onChange={e => setAutoLimits({ ...autoLimits, lifetimeCpcLimit: e.target.value })} /></div>
                  <div className="form-group"><label>Số click tối đa trọn đời</label><input type="number" min="0" placeholder="0" value={autoLimits.lifetimeClickLimit} onChange={e => setAutoLimits({ ...autoLimits, lifetimeClickLimit: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div className="form-group"><label>Chi tiêu tối đa trọn đời khi 0-1 TN</label><input type="number" min="0" placeholder="25000" value={autoLimits.lifetimeZero} onChange={e => setAutoLimits({ ...autoLimits, lifetimeZero: e.target.value })} /></div>
                  <div className="form-group"><label>Giá TN tối đa trọn đời</label><input type="number" min="0" placeholder="20000" value={autoLimits.lifetimeHighCost} onChange={e => setAutoLimits({ ...autoLimits, lifetimeHighCost: e.target.value })} /></div>
                  <div className="form-group"><label>Chi tiêu tối đa trọn đời khi TN đắt</label><input type="number" min="0" placeholder="50000" value={autoLimits.lifetimeHighSpend} onChange={e => setAutoLimits({ ...autoLimits, lifetimeHighSpend: e.target.value })} /></div>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn btn-p btn-sm" onClick={() => save('/auto-limits', {
              dailyZeroMessageSpendLimit: Number(autoLimits.dailyZero),
              dailyHighCostPerMessageLimit: Number(autoLimits.dailyHighCost),
              dailyHighCostSpendLimit: Number(autoLimits.dailyHighSpend),
              dailyClickLimit: Number(autoLimits.dailyClickLimit || 0),
              dailyCpcLimit: Number(autoLimits.dailyCpcLimit || 0),
              lifetimeZeroMessageSpendLimit: Number(autoLimits.lifetimeZero),
              lifetimeHighCostPerMessageLimit: Number(autoLimits.lifetimeHighCost),
              lifetimeHighCostSpendLimit: Number(autoLimits.lifetimeHighSpend),
              lifetimeClickLimit: Number(autoLimits.lifetimeClickLimit || 0),
              lifetimeCpcLimit: Number(autoLimits.lifetimeCpcLimit || 0)
            }, 'Đã lưu giới hạn tự động')}>Lưu giới hạn</button>
          </div>
        </section>

      </div>
    </div>
  );
}
