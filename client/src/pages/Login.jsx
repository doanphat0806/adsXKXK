import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

export default function Login() {
  const { login } = useAppContext();
  const [isRegister, setIsRegister] = useState(false);
  const [provider, setProvider] = useState('facebook');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi kết nối');

      if (isRegister) {
        setMsg('Đăng ký thành công! Vui lòng đăng nhập.');
        setIsRegister(false);
        setPassword('');
      } else {
        login(data.token, data.username, provider);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: 'var(--bg)',
      zIndex: 9999
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
          {isRegister ? 'Đăng ký Tài khoản' : 'Đăng nhập Hệ thống'}
        </h2>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            className={`btn ${provider === 'facebook' ? 'btn-p' : 'btn-ghost'}`} 
            style={{ flex: 1 }}
            onClick={() => setProvider('facebook')}
          >
            🔵 Facebook
          </button>
          <button 
            className={`btn ${provider === 'shopee' ? 'btn-s' : 'btn-ghost'}`} 
            style={{ flex: 1 }}
            onClick={() => setProvider('shopee')}
          >
            🟠 Shopee
          </button>
        </div>

        {error && <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}
        {msg && <div style={{ color: 'green', marginBottom: '15px', textAlign: 'center' }}>{msg}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tài khoản</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Mật khẩu</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-p" style={{ width: '100%', marginTop: '10px' }}>
            {isRegister ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </button>
        </div>
      </div>
    </div>
  );
}
