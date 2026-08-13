import React, { useState, useEffect } from 'react';

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

export const Settings: React.FC = () => {
  const [tab, setTab] = useState<'llm' | 'plugins' | 'mobile'>('llm');
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
    } catch {
      setPairCode(String(Math.floor(100000 + Math.random() * 900000)));
    }
    // Get local IP via WebRTC or fallback
    try {
      const pc = new RTCPeerConnection();
      pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const match = pc.localDescription?.sdp?.match(/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/);
      setDesktopIp(match?.[0] || '127.0.0.1');
      pc.close();
    } catch {
      setDesktopIp('127.0.0.1');
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

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--accent-light)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 400,
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    transition: 'all var(--transition)',
  });

  return (
    <div className="card" style={{ padding: 24, maxWidth: 560 }}>
      <h2 style={{
        fontSize: 20,
        marginBottom: 8,
        fontFamily: 'var(--font-serif)',
        color: 'var(--text-primary)',
        fontWeight: 700,
      }}>
        设置
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        {tab === 'llm' ? '配置本地模型和云端 API' : '管理已安装和可用的插件'}
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        <button onClick={() => setTab('llm')} style={tabStyle(tab === 'llm')}>模型设置</button>
        <button onClick={() => setTab('plugins')} style={tabStyle(tab === 'plugins')}>插件管理</button>
        <button onClick={() => setTab('mobile')} style={tabStyle(tab === 'mobile')}>移动端配对</button>
      </div>

      {tab === 'mobile' && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            生成配对码以连接移动设备（同一 WiFi 下）
          </p>
          {!pairGenerated ? (
            <button onClick={generatePairCode} style={{
              padding: '12px 32px', background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}>
              生成配对码
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                桌面 IP: {desktopIp}
              </div>
              <div style={{
                fontSize: 32, fontWeight: 700, letterSpacing: 8,
                color: 'var(--accent)', fontFamily: 'monospace',
                marginBottom: 16, padding: '12px 24px',
                background: 'var(--accent-soft)', borderRadius: 'var(--radius)',
                display: 'inline-block',
              }}>
                {pairCode}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                在移动端输入 IP <b>{desktopIp}</b> 和配对码 <b>{pairCode}</b>
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'plugins' && (
        <div>
          <div style={{
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius)',
            padding: 14,
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
          }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: 'var(--accent)' }}>How to install plugins</p>
            <p style={{ margin: 0 }}>Drop plugin folders into <code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>~/.yanmo/plugins/</code></p>
            <p style={{ margin: '4px 0 0 0' }}>Each plugin needs a <code>plugin.toml</code> manifest and a <code>plugin.py</code> file implementing the Plugin interface.</p>
          </div>

          {plugins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              No plugins discovered. Add plugins to the directory above.
            </div>
          ) : (
            plugins.map((p) => (
              <div key={p.name}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 16px',
                  marginBottom: 10,
                  background: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.display_name}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>v{p.version}</span>
                    <span style={{
                      fontSize: 10, marginLeft: 8, padding: '1px 6px', borderRadius: 8,
                      background: p.source === 'user' ? 'var(--accent-soft)' : 'var(--green-bg)',
                      color: p.source === 'user' ? 'var(--accent)' : 'var(--green)',
                    }}>
                      {p.source === 'user' ? 'user' : 'builtin'}
                    </span>
                  </div>
                  {p.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                      {p.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: p.loaded ? 'var(--green)' : 'var(--text-muted)',
                  }} />
                  <span style={{ fontSize: 11, color: p.loaded ? 'var(--green)' : 'var(--text-muted)' }}>
                    {p.loaded ? 'loaded' : 'inactive'}
                  </span>
                  <button
                    onClick={() => togglePlugin(p.name, p.loaded)}
                    style={{
                      padding: '4px 12px', fontSize: 11,
                      border: '1px solid var(--border)', borderRadius: 4,
                      background: 'var(--bg-input)', color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}>
                    {p.loaded ? 'Unload' : 'Load'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'llm' && (<>

      {settings.cloud_api_key && !warningAccepted && (
        <div style={{
          background: 'var(--red-bg)',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius)',
          padding: 18,
          marginBottom: 20,
        }}>
          <p style={{ fontWeight: 600, color: 'var(--red)', margin: '0 0 10px 0', fontSize: 14 }}>
            隐私风险提示
          </p>
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            发送到云端 API 的数据会离开你的电脑。导师未公开的研究思路、实验数据、专利相关材料请勿使用云端模型处理。如不确定，请先咨询导师。
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={warningAccepted} onChange={(e) => setWarningAccepted(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }} />
            我已理解以上风险，自行承担使用云端 API 的后果
          </label>
        </div>
      )}

      <fieldset style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px 18px',
        marginBottom: 14,
        background: 'var(--bg-card)',
      }}>
        <legend style={{
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--text-primary)',
          padding: '0 8px',
        }}>
          本地模型 (Ollama)
        </legend>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 10, color: 'var(--text-secondary)' }}>
          地址
          <input value={settings.ollama_base_url} onChange={(e) => setSettings({ ...settings, ollama_base_url: e.target.value })}
            style={inputStyle} />
        </label>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)' }}>
          模型
          <input value={settings.ollama_model} onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
            style={inputStyle} />
        </label>
      </fieldset>

      <fieldset style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px 18px',
        marginBottom: 20,
        background: 'var(--bg-card)',
      }}>
        <legend style={{
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--text-primary)',
          padding: '0 8px',
        }}>
          云端 API（可选）
        </legend>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          仅在数据处理为"公开"级别时使用
        </p>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 10, color: 'var(--text-secondary)' }}>
          提供商
          <select value={settings.cloud_provider} onChange={(e) => setSettings({ ...settings, cloud_provider: e.target.value })}
            style={selectStyle}>
            <option value="">不使用</option>
            <option value="claude">Claude</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 10, color: 'var(--text-secondary)' }}>
          API Key
          <input type="password" value={settings.cloud_api_key} onChange={(e) => setSettings({ ...settings, cloud_api_key: e.target.value })}
            style={inputStyle} />
        </label>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)' }}>
          模型名
          <input value={settings.cloud_model} onChange={(e) => setSettings({ ...settings, cloud_model: e.target.value })}
            style={inputStyle} placeholder="如 claude-sonnet-4-6" />
        </label>
      </fieldset>

      <button onClick={save} style={{
        padding: '10px 32px',
        background: 'var(--accent)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        transition: 'all var(--transition)',
      }}>
        {saved ? '已保存' : '保存设置'}
      </button>
      </>)}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  marginTop: 4,
  boxSizing: 'border-box',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};
