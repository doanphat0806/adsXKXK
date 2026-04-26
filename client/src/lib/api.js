const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function api(method, path, body = null) {
  const opts = { 
    method, 
    headers: { 'Content-Type': 'application/json' } 
  };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(API_URL + path, opts);
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || 'API error');
  }
  
  return data;
}

export const formatVND = (n) => Number(n || 0).toLocaleString('vi-VN') + '₫';
export const formatNumber = (n) => Number(n || 0).toLocaleString('vi-VN');
export const todayString = () => {
  const d = new Date();
  const vnTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().split('T')[0];
};
export const timeString = (d) => new Date(d).toLocaleTimeString('vi-VN', { 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh'
});
