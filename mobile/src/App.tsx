import { useCallback, useEffect, useState } from 'react';
import {
  clearDesktopAddress,
  discoverDesktop,
  getSavedDesktopAddress,
  saveDesktopAddress,
} from './core/Discovery';

const BACKEND_PORT = 8000;

const apiBase = (ip: string) => `http://${ip}:${BACKEND_PORT}/api`;

type Phase = 'searching' | 'offline' | 'ready';

/**
 * 研墨移动端伴生应用 —— 局域网内配对桌面端，把手机变成桌面功能的遥控器。
 *
 * 界面遵循 DNDL v1.0：直角、品牌实色块、色块正文用 --dn-text-on-color，
 * Canvas 上的次要文字用 --dn-text-secondary；状态以「形状 + 文字」表达而非仅靠颜色。
 */
export const MobileApp: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('searching');
  const [progress, setProgress] = useState<{ checked: number; total: number } | null>(null);
  const [connectedIp, setConnectedIp] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [pairError, setPairError] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = useCallback(async (ip: string, token: string): Promise<boolean> => {
    try {
      const resp = await fetch(`${apiBase(ip)}/health`, {
        headers: token
          ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          : { 'Content-Type': 'application/json' },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. 先试已保存的配对
      const saved = getSavedDesktopAddress();
      if (saved && (await verify(saved.ip, saved.token))) {
        if (!cancelled) {
          setConnectedIp(saved.ip);
          setPhase('ready');
        }
        return;
      }

      // 2. 局域网发现（原实现只显示"正在搜索"却从未真正搜索）
      const found = await discoverDesktop((checked, total) => {
        if (!cancelled) setProgress({ checked, total });
      });

      if (cancelled) return;
      setProgress(null);

      if (found && (await verify(found.ip, ''))) {
        saveDesktopAddress(found.ip, '');
        setConnectedIp(found.ip);
        setPhase('ready');
      } else {
        setPhase('offline');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [verify]);

  async function handlePair() {
    setPairError('');
    setBusy(true);
    try {
      const resp = await fetch(`${apiBase(manualIp)}/auth/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairCode }),
      });
      if (!resp.ok) throw new Error('配对码无效或已过期');
      const data = (await resp.json()) as { token?: string };
      const token = data.token ?? '';
      saveDesktopAddress(manualIp, token);
      setConnectedIp(manualIp);
      setPhase('ready');
    } catch (e) {
      setPairError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    clearDesktopAddress();
    setConnectedIp('');
    setPairCode('');
    setPhase('offline');
  }

  const statusText =
    phase === 'searching'
      ? progress
        ? `正在搜索桌面后端 ${progress.checked}/${progress.total}`
        : '正在搜索桌面后端…'
      : phase === 'ready'
        ? '已连接'
        : '尚未连接';

  return (
    <div className="screen">
      <header className="brand-field">
        <p className="kicker">YANMO · MOBILE</p>
        <h1>研墨</h1>
        <p className="brand-sub">手机作为桌面端的遥控器，通过同一局域网连接。</p>
      </header>

      <main className="panel">
        <p className={`status status--${phase}`}>{statusText}</p>

        {phase === 'ready' ? (
          <>
            <div className="connected-block">
              <p className="label">已连接桌面端</p>
              <p className="addr">
                {connectedIp}:{BACKEND_PORT}
              </p>
            </div>
            <ul className="facts">
              <li>
                <span className="k">连接方式</span>
                <span>局域网直连</span>
              </li>
              <li>
                <span className="k">端口</span>
                <span>{BACKEND_PORT}</span>
              </li>
            </ul>
            <button type="button" className="btn btn--quiet dn-focus" onClick={handleDisconnect}>
              断开并重新配对
            </button>
          </>
        ) : (
          <>
            <p className="hint">
              在桌面端「设置 → 移动端配对」生成配对码，然后填在下面。
              手机与电脑需处于同一局域网。
            </p>

            <div className="field">
              <label htmlFor="ip">桌面端 IP</label>
              <input
                id="ip"
                inputMode="decimal"
                autoComplete="off"
                placeholder="192.168.1.5"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="code">6 位配对码</label>
              <input
                id="code"
                className="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={pairCode}
                onChange={(e) => setPairCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {pairError && (
              <p className="error" role="alert">
                {pairError}
              </p>
            )}

            <button
              type="button"
              className="btn dn-interactive dn-focus"
              onClick={handlePair}
              disabled={busy || !manualIp || pairCode.length !== 6}
            >
              {busy ? '正在连接…' : '连接'}
            </button>
          </>
        )}
      </main>
    </div>
  );
};
