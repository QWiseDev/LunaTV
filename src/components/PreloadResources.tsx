'use client';

import { useEffect } from 'react';

/**
 * 预加载关键资源组件
 * 用于优化首屏加载性能
 */
export function PreloadResources() {
  useEffect(() => {
    // 预连接到关键域名
    const domains = [
      'https://api.douban.com',
      'https://img.doubanio.com',
      'https://api.bgm.tv',
    ];

    domains.forEach((domain) => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    // 预加载关键API
    const criticalApis = [
      '/api/douban/categories?kind=movie&category=热门&type=全部',
      '/api/douban/categories?kind=tv&category=tv&type=tv',
    ];

    if ('fetch' in window && 'IntersectionObserver' in window) {
      // 使用 requestIdleCallback 延迟预加载
      const win = window as typeof window & {
        requestIdleCallback?: (callback: IdleRequestCallback) => number;
      };

      const prefetch = () => {
        criticalApis.forEach((url) => {
          fetch(url, {
            method: 'GET',
            priority: 'low',
          } as RequestInit).catch(() => {
            // 忽略预加载错误
          });
        });
      };

      if (typeof win.requestIdleCallback === 'function') {
        win.requestIdleCallback(prefetch);
      } else {
        setTimeout(prefetch, 2000);
      }
    }
  }, []);

  return null;
}
