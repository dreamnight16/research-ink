import React, { useState, useEffect } from 'react';
import { setTransparencyPreference, transparencyOff } from './transparency';

interface LLMSettings {
  ollama_base_url: string;
  ollama_model: string;
  cloud_provider: string;
  cloud_api_key: string;
  cloud_model: string;
}

interface PluginInfo {
  name: string;
  display_name: string;
  version: string;
  description: string;
  author: string;
  source: string;
  loaded: boolean;
}

interface Props {
  onClose: () => void;
}

type SettingsTab = 'llm' | 'plugins' | 'mobile';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'llm', label: '模型设置' },
  { key: 'plugins', label: '插件管理' },
  { key: 'mobile', label: '移动端配对' },
];

export const Settings: React.FC<Props> = ({ onClose }) => {
  const [tab, setTab] = useState<SettingsTab>('llm');
  const [settings, setSettings] = useState<LLMSettings>({
    ollama_base_url: 'http://localhost:11434',
    ollama_model: 'qwen3:14b',
    cloud_provider: '',
    cloud_api_key: '',
    cloud_model: '',
  });
  const [saved, setSaved] = useState(false);
  const [warningAccepted, setWarningAccepted] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [desktopIp, setDesktopIp] = useState('');
  const [pairGenerated, setPairGenerated] = useState(false);
  /** 服务端没有登记配对码时为 true，此时界面必须说明该码不可用 */
  const [pairIsLocalOnly, setPairIsLocalOnly] = useState(false);
  const [ipIsFallback, setIpIsFallback] = useState(false);
  const [noTransparency, setNoTransparency] = useState(transparencyOff);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/settings')
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  const [plugins, setPlugins] = useState<PluginInfo[]>([]);

  const loadPlugins = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/plugins/available');
      const data = await res.json();
      setPlugins(data.plugins || []);
    } catch (err) {
      console.error('Failed to load plugins:', err);
    }
  };

  useEffect(() => {
    if (tab === 'plugins') loadPlugins();
  }, [tab]);

  const togglePlugin = async (name: string, loaded: boolean) => {
    const endpoint = loaded ? 'unload' : 'load';
    await fetch(`/api/plugins/${name}/${endpoint}`, { method: 'POST' });
    loadPlugins();
  };

  const generatePairCode = async () => {
    // Generate the code server-side so it is actually stored for pairing.
    try {
      const tokenResp = await fetch('http://127.0.0.1:8000/api/auth/token');
      const tokenData = await tokenResp.json();
      const resp = await fetch('http://127.0.0.1:8000/api/auth/pair/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.token}` },
      });
      const data = await resp.json();
      setPairCode(data.code);
      setPairIsLocalOnly(false);
    } catch {
      // 后端不可用时仍给出一个数字，但必须标明它没有在服务端登记
      setPairCode(String(Math.floor(100000 + Math.random() * 900000)));
      setPairIsLocalOnly(true);
    }
    // Get local IP via WebRTC or fallback
    try {
      const pc = new RTCPeerConnection();
      pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const match = pc.localDescription?.sdp?.match(/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/);
      setDesktopIp(match?.[0] || '127.0.0.1');
      setIpIsFallback(!match?.[0]);
      pc.close();
    } catch {
      setDesktopIp('127.0.0.1');
      setIpIsFallback(true);
    }
    setPairGenerated(true);
  };

  const save = async () => {
    await fetch('http://127.0.0.1:8000/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="ink-drawer__head">
        <div>
          <p className="ink-kicker">Settings</p>
          <h2 className="ink-h2" id="settings-title">工作台设置</h2>
        </div>
        <button type="button" className="ink-btn ink-btn--ghost" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="ink-drawer__body">
        <div className="ink-seg" role="group" aria-label="设置分区">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="ink-seg__opt"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ink-stack" style={{ marginTop: 24 }}>
          {tab === 'mobile' && (
            <section className="ink-panel ink-panel--accent">
              <p className="ink-note">
                生成配对码以连接移动设备（需要与桌面端处于同一 WiFi）。
              </p>
              {!pairGenerated ? (
                <button
                  type="button"
                  className="ink-btn ink-btn--primary"
                  onClick={generatePairCode}
                  style={{ marginTop: 16 }}
                >
                  生成配对码
                </button>
              ) : (
                <div className="ink-stack" style={{ marginTop: 16 }}>
                  {pairIsLocalOnly && (
                    <div className="ink-notice" data-tone="warn">
                      <p className="ink-notice__title">这个配对码没有在服务端登记</p>
                      <p>
                        后端没有返回配对码，下面的数字只是本机临时生成的占位值，无法用于配对。
                        请先确认本地后端已启动再重新生成。
                      </p>
                    </div>
                  )}
                  <p className="ink-kicker">桌面地址</p>
                  <p className="ink-num" style={{ fontSize: '1.5rem' }}>{desktopIp}</p>
                  {ipIsFallback && (
                    <p className="ink-note ink-note--sm">
                      未取到局域网地址，显示的是回环地址 127.0.0.1，手机可能无法访问。
                    </p>
                  )}
                  <p className="ink-kicker">配对码</p>
                  <p className="ink-num" style={{ fontSize: '2.5rem', letterSpacing: '0.2em' }}>
                    {pairCode}
                  </p>
                  <p className="ink-note">在移动端输入上面的地址与配对码完成配对。</p>
                </div>
              )}
            </section>
          )}

          {tab === 'plugins' && (
            <section className="ink-stack">
              <div className="ink-notice" data-tone="info">
                <p className="ink-notice__title">如何安装插件</p>
                <p>
                  把插件目录放进 <code className="ink-code">~/.yanmo/plugins/</code>，
                  每个插件需要 <code className="ink-code">plugin.toml</code> 清单和实现
                  Plugin 接口的 <code className="ink-code">plugin.py</code>。
                </p>
              </div>

              {plugins.length === 0 ? (
                <div className="ink-empty">
                  <p className="ink-empty__mark" aria-hidden="true">—</p>
                  <p className="ink-h3">没有发现插件</p>
                  <p className="ink-note">把插件放进上面的目录后回到这里重新查看。</p>
                </div>
              ) : (
                <div className="ink-list">
                  {plugins.map((p) => (
                    <div className="ink-list__row" key={p.name}>
                      <div className="ink-list__main">
                        <p className="ink-h3">
                          {p.display_name}{' '}
                          <span className="ink-note ink-note--sm">v{p.version}</span>
                        </p>
                        {p.description && <p className="ink-note">{p.description}</p>}
                        <p className="ink-list__meta">
                          <span>{p.source === 'user' ? '用户插件' : '内置插件'}</span>
                          {p.author && <span>{p.author}</span>}
                        </p>
                      </div>
                      <div className="ink-row">
                        <span className="ink-flag" data-tone={p.loaded ? 'ok' : 'neutral'}>
                          <span aria-hidden="true">{p.loaded ? '●' : '○'}</span>
                          <span>{p.loaded ? '已加载' : '未加载'}</span>
                        </span>
                        <button
                          type="button"
                          className="ink-btn ink-btn--sm"
                          onClick={() => togglePlugin(p.name, p.loaded)}
                        >
                          {p.loaded ? '卸载' : '加载'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'llm' && (
            <>
              {settings.cloud_api_key && !warningAccepted && (
                <div className="ink-notice" data-tone="danger">
                  <p className="ink-notice__title">隐私风险提示</p>
                  <p>
                    发送到云端 API 的数据会离开你的电脑。导师未公开的研究思路、实验数据、
                    专利相关材料请勿使用云端模型处理。如不确定，请先咨询导师。
                  </p>
                  <label className="ink-check">
                    <input
                      type="checkbox"
                      checked={warningAccepted}
                      onChange={(e) => setWarningAccepted(e.target.checked)}
                    />
                    <span>我已理解以上风险，自行承担使用云端 API 的后果</span>
                  </label>
                </div>
              )}

              <section className="ink-panel">
                <p className="ink-kicker">本地模型 · Ollama</p>
                <div className="ink-stack" style={{ marginTop: 14 }}>
                  <label className="ink-field">
                    <span className="ink-label">地址</span>
                    <input
                      className="ink-input"
                      value={settings.ollama_base_url}
                      onChange={(e) => setSettings({ ...settings, ollama_base_url: e.target.value })}
                    />
                  </label>
                  <label className="ink-field">
                    <span className="ink-label">模型</span>
                    <input
                      className="ink-input"
                      value={settings.ollama_model}
                      onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
                    />
                  </label>
                </div>
              </section>

              <section className="ink-panel">
                <p className="ink-kicker">云端 API · 可选</p>
                <p className="ink-note ink-note--sm" style={{ marginTop: 6 }}>
                  仅在数据处理级别为「公开」时使用；留空表示全部走本地模型。
                </p>
                <div className="ink-stack" style={{ marginTop: 14 }}>
                  <label className="ink-field">
                    <span className="ink-label">提供商</span>
                    <select
                      className="ink-select"
                      value={settings.cloud_provider}
                      onChange={(e) => setSettings({ ...settings, cloud_provider: e.target.value })}
                    >
                      <option value="">不使用</option>
                      <option value="claude">Claude</option>
                      <option value="openai">OpenAI</option>
                      <option value="deepseek">DeepSeek</option>
                    </select>
                  </label>
                  <label className="ink-field">
                    <span className="ink-label">API Key</span>
                    <input
                      className="ink-input"
                      type="password"
                      value={settings.cloud_api_key}
                      onChange={(e) => setSettings({ ...settings, cloud_api_key: e.target.value })}
                    />
                  </label>
                  <label className="ink-field">
                    <span className="ink-label">模型名</span>
                    <input
                      className="ink-input"
                      value={settings.cloud_model}
                      onChange={(e) => setSettings({ ...settings, cloud_model: e.target.value })}
                      placeholder="如 claude-sonnet-4-6"
                    />
                  </label>
                </div>
              </section>

              <div className="ink-row">
                <button type="button" className="ink-btn ink-btn--primary" onClick={save}>
                  {saved ? '已保存' : '保存设置'}
                </button>
                {saved && (
                  <span className="ink-flag" data-tone="ok">
                    <span>已写入后端设置</span>
                  </span>
                )}
              </div>
            </>
          )}

          <section className="ink-panel">
            <p className="ink-kicker">外观</p>
            <h3 className="ink-h3" style={{ marginTop: 4 }}>界面材质</h3>
            <p className="ink-note ink-note--sm" style={{ marginTop: 6 }}>
              设置抽屉使用 DNDL 的半透明材质。系统启用「减少透明效果」时会自动回退为不透明，
              也可以在这里手动关闭。
            </p>
            <label className="ink-check" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={noTransparency}
                onChange={(e) => {
                  setNoTransparency(e.target.checked);
                  setTransparencyPreference(e.target.checked);
                }}
              />
              <span>关闭半透明效果，覆盖层使用不透明背景</span>
            </label>
          </section>
        </div>
      </div>
    </>
  );
};
