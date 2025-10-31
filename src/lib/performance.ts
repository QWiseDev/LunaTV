/**
 * 性能优化工具函数
 */

/**
 * 图片懒加载配置
 */
export const imageLoadingConfig = {
  loading: 'lazy' as const,
  placeholder: 'blur' as const,
  quality: 75,
};

/**
 * 延迟执行函数，使用 requestIdleCallback 或 setTimeout
 */
export const idleCallback = (callback: () => void, timeout = 2000): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {
      // No-op on server side
    };
  }

  const win = window as typeof window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  let idleCallbackId: number | undefined;
  let timeoutId: number | undefined;
  let cancelled = false;

  if (typeof win.requestIdleCallback === 'function') {
    idleCallbackId = win.requestIdleCallback(() => {
      if (!cancelled) callback();
    }, { timeout });
  } else {
    timeoutId = window.setTimeout(() => {
      if (!cancelled) callback();
    }, timeout / 2);
  }

  return () => {
    cancelled = true;
    if (idleCallbackId !== undefined && typeof win.cancelIdleCallback === 'function') {
      win.cancelIdleCallback(idleCallbackId);
    }
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  };
};

/**
 * 预连接到重要域名
 */
export const preconnectDomains = [
  'https://api.douban.com',
  'https://img.doubanio.com',
];

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 批量更新状态
 */
export const batchStateUpdates = <T>(
  updates: Array<() => void>,
  delay = 16
): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      updates.forEach((update) => update());
      resolve();
    }, delay);
  });
};
