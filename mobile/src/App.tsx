import React, { useState, useEffect } from 'react';
import type { ChatMessage } from './types';

// 动态导入桌面地址
let API_BASE = 'http://127.0.0.1:8000/api';
let WS_BASE = 'ws://127.0.0.1:8000/api/ws';
let AUTH_TOKEN = '';

function updateEndpoints(ip: string, token: string) {
  API_BASE = `http://${ip}:8000/api`;
  WS_BASE = `ws://${ip}:8000/api/ws`;
  AUTH_TOKEN = token;
}

function authHeaders(): Record<string, string> {
  return AUTH_TOKEN
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_TOKEN}` }
    : { 'Content-Type': 'application/json' };
}

// ===== 简单的移动端 App 壳 =====
export const MobileApp: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [searching, setSearching] = useState(true);
  const [backendIp, setBackendIp] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [pairError, setPairError] = useState('');
  const [manualIp, setManualIp] = useState('');

  // 启动时尝试发现桌面后端
  useEffect(() => {
    const saved = localStorage.getItem('yanmo-desktop-ip');
    const token = localStorage.getItem('yanmo-auth-token');
    if (saved && token) {
      updateEndpoints(saved, token);
      checkConnection().then((ok) => {
        if (ok) {
          setConnected(true);
          setBackendIp(saved);
          setSearching(false);
        } else {
          setSearching(false);
        }
      });
    } else {
      setSearching(false);
    }
  }, []);

  async function checkConnection(): Promise<boolean> {
    try {
      const resp = await fetch(`${API_BASE}/health`, { headers: authHeaders() });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async function handlePair() {
    setPairError('');
    try {
      const resp = await fetch(`http://${manualIp}:8000/api/auth/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairCode }),
      });
      if (!resp.ok) throw new Error('配对码无效');
      const data = await resp.json();
      updateEndpoints(manualIp, data.token);
      localStorage.setItem('yanmo-desktop-ip', manualIp);
      localStorage.setItem('yanmo-auth-token', data.token);
      setConnected(true);
      setBackendIp(manualIp);
    } catch (e) {
      setPairError((e as Error).message);
    }
  }

  // 未连接时显示配对界面
  if (!connected) {
    return (
      <div className="pair-screen">
        <h2>研墨</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {searching ? '正在搜索桌面后端...' : '请连接到桌面应用'}
        </p>
        {!searching && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              在桌面端「设置」中打开配对二维码，<br />
              或手动输入桌面 IP 和配对码。
            </p>
            <input
              placeholder="桌面 IP (如 192.168.1.5)"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
            />
            <input
              placeholder="6 位配对码"
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value)}
              maxLength={6}
            />
            <button onClick={handlePair} disabled={!manualIp || !pairCode}>
              连接
            </button>
            {pairError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{pairError}</p>}
          </>
        )}
      </div>
    );
  }

  // 已连接
  return (
    <div className="connect-banner connected">
      已连接 {backendIp}
    </div>
  );
};
