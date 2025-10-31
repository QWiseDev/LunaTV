/**
 * 性能监控工具
 * 用于监控和记录页面性能指标
 */

export interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};

  constructor() {
    if (typeof window === 'undefined') return;
    this.initObservers();
  }

  private initObservers() {
    // 监听 FCP
    this.observePaint('first-contentful-paint', (entry) => {
      this.metrics.fcp = entry.startTime;
    });

    // 监听 LCP
    this.observeLCP();

    // 监听 FID
    this.observeFID();

    // 监听 CLS
    this.observeCLS();

    // 获取 TTFB
    this.getTTFB();
  }

  private observePaint(name: string, callback: (entry: PerformanceEntry) => void) {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === name) {
            callback(entry);
          }
        });
      });
      observer.observe({ entryTypes: ['paint'] });
    } catch (e) {
      // 浏览器不支持
    }
  }

  private observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // 浏览器不支持
    }
  }

  private observeFID() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.fid = entry.processingStart - entry.startTime;
        });
      });
      observer.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // 浏览器不支持
    }
  }

  private observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.metrics.cls = clsValue;
          }
        });
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // 浏览器不支持
    }
  }

  private getTTFB() {
    if (typeof window === 'undefined' || !window.performance) return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.metrics.ttfb = navigation.responseStart - navigation.requestStart;
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public logMetrics() {
    if (process.env.NODE_ENV === 'development') {
      console.table(this.metrics);
    }
  }

  public reportMetrics(endpoint?: string) {
    if (!endpoint) return;

    // 发送性能指标到服务器
    const data = {
      url: window.location.href,
      metrics: this.metrics,
      timestamp: Date.now(),
    };

    // 使用 sendBeacon 确保数据发送
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(data));
    } else {
      fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // 忽略错误
      });
    }
  }
}

// 单例模式
let monitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitor && typeof window !== 'undefined') {
    monitor = new PerformanceMonitor();
  }
  return monitor as PerformanceMonitor;
}

/**
 * 记录组件渲染时间
 */
export function measureComponentRender(componentName: string, callback: () => void) {
  if (typeof window === 'undefined' || !window.performance) {
    callback();
    return;
  }

  const startMark = `${componentName}-start`;
  const endMark = `${componentName}-end`;
  const measureName = `${componentName}-render`;

  performance.mark(startMark);
  callback();
  performance.mark(endMark);

  try {
    performance.measure(measureName, startMark, endMark);
    const measure = performance.getEntriesByName(measureName)[0];
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} 渲染时间: ${measure.duration.toFixed(2)}ms`);
    }

    // 清理标记
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  } catch (e) {
    // 忽略错误
  }
}
