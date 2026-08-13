/**
 * 移动端 LAN 发现模块 — 检测局域网内的桌面后端。
 * 优先使用 mDNS，fallback 到手动输入 IP。
 */

// 常见家庭/实验室局域网前缀
const LAN_PREFIXES = [
  '192.168.',
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
];

const BACKEND_PORT = 8000;

export interface DiscoveryResult {
  ip: string;
  hostname: string;
  manual: boolean;
}

/**
 * 尝试在 LAN 上发现桌面后端。
 * 并发探测常见 IP 范围的 /api/health 端点。
 */
export async function discoverDesktop(
  onProgress?: (checked: number, total: number) => void
): Promise<DiscoveryResult | null> {
  const ips = generateLanIPs();
  const total = ips.length;
  let checked = 0;

  // 分批并发探测（每次 20 个 IP，避免浏览器限制）
  const batchSize = 20;
  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (ip) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 800);
          const resp = await fetch(`http://${ip}:${BACKEND_PORT}/api/health`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (resp.ok) {
            return { ip, hostname: ip, manual: false };
          }
        } catch { /* 该 IP 无后端 */ }
        return null;
      })
    );
    checked += batch.length;
    onProgress?.(checked, total);
    const found = results.find((r) => r !== null);
    if (found) return found;
  }
  return null;
}

/**
 * 生成要探测的 LAN IP 列表（基于常见前缀，跳过 .0 和 .255 及当前 IP）
 */
function generateLanIPs(): string[] {
  const ips: string[] = [];
  for (const prefix of LAN_PREFIXES) {
    for (let d = 1; d < 255; d++) {
      ips.push(`${prefix}${d}`);
    }
  }
  // Shuffle to spread load (避免同时打爆同一网段)
  for (let i = ips.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ips[i], ips[j]] = [ips[j], ips[i]];
  }
  return ips.slice(0, 200); // 最多探测 200 个 IP
}

/**
 * 保存已配对的桌面地址到 localStorage。
 *
 * 安全注意：`token` 是 Bearer 凭据，此处以明文写入 localStorage（WebView 存储）。
 * 在已 root 的设备上，或 WebView 存储被窃取时，令牌可能被读取并用于冒充配对设备。
 * 后续应迁移到安全存储（如 @capacitor/preferences 的加密后端，或原生 Keystore/Keychain）。
 * 未配对/清除时请调用 {@link clearDesktopAddress} 一并移除令牌。
 */
export function saveDesktopAddress(ip: string, token: string): void {
  localStorage.setItem('yanmo-desktop-ip', ip);
  localStorage.setItem('yanmo-desktop-port', String(BACKEND_PORT));
  localStorage.setItem('yanmo-auth-token', token);
}

/**
 * 获取已保存的桌面地址，没有则返回 null。
 */
export function getSavedDesktopAddress(): { ip: string; port: number; token: string } | null {
  const ip = localStorage.getItem('yanmo-desktop-ip');
  const port = localStorage.getItem('yanmo-desktop-port');
  const token = localStorage.getItem('yanmo-auth-token');
  if (ip && port && token) {
    return { ip, port: parseInt(port, 10), token };
  }
  return null;
}

/**
 * 清除已保存的桌面地址。
 */
export function clearDesktopAddress(): void {
  localStorage.removeItem('yanmo-desktop-ip');
  localStorage.removeItem('yanmo-desktop-port');
  localStorage.removeItem('yanmo-auth-token');
}
