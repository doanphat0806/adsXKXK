import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

export default function AuthScreen() {
  const { login } = useAppContext();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    login(user, pass);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Đăng nhập quản trị</h1>
        <form onSubmit={handleLogin}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="form-group full">
              <label>Tài khoản</label>
              <input 
                type="text" 
                placeholder="admin" 
                value={user}
                onChange={(e) => setUser(e.target.value)}
              />
            </div>
            <div className="form-group full">
              <label>Mật khẩu</label>
              <input 
                type="password" 
                placeholder="admin" 
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions" style={{ justifyContent: 'stretch' }}>
            <button type="submit" className="btn btn-g" style={{ width: '100%', justifyContent: 'center' }}>
              Đăng nhập
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
