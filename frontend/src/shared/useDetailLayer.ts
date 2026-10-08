import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * 详情层（抽屉 / 弹窗）的键盘与焦点契约：
 * - Escape 关闭；
 * - Tab 在层内循环，不跑到被覆盖的页面上；
 * - 关闭后焦点回到触发元素；
 * - 底层页面不被卸载，因此滚动位置与操作状态保持原样。
 */
export function useDetailLayer(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = (): HTMLElement[] =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    (focusable()[0] ?? node)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        node?.focus();
        return;
      }
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? current <= 0
          ? items.length - 1
          : current - 1
        : current === -1 || current === items.length - 1
          ? 0
          : current + 1;
      event.preventDefault();
      items[next].focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      opener?.focus();
    };
  }, [active]);

  return ref;
}
