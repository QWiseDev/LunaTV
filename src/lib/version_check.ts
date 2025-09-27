/* eslint-disable no-console */

'use client';

import { CURRENT_VERSION } from "@/lib/version";

// 版本检查结果枚举
export enum UpdateStatus {
  HAS_UPDATE = 'has_update', // 有新版本
  NO_UPDATE = 'no_update', // 无新版本
  FETCH_FAILED = 'fetch_failed', // 获取失败
}

// 从运行时配置解析版本检查地址
function parseRuntimeVersionUrls(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  type RuntimeConfig = {
    VERSION_CHECK_URLS?: string[] | string | null;
  };

  const runtimeConfig = (window as Window & { RUNTIME_CONFIG?: RuntimeConfig })
    .RUNTIME_CONFIG;
  const runtimeValue = runtimeConfig?.VERSION_CHECK_URLS ?? null;

  if (!runtimeValue) {
    return [];
  }

  if (Array.isArray(runtimeValue)) {
    return runtimeValue
      .map((url) => (typeof url === 'string' ? url.trim() : ''))
      .filter(Boolean);
  }

  if (typeof runtimeValue === 'string') {
    return runtimeValue
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
  }

  return [];
}

// 从环境变量解析版本检查地址
function parseEnvVersionUrls(): string[] {
  const envValue = process.env.NEXT_PUBLIC_VERSION_CHECK_URLS;
  if (!envValue) {
    return [];
  }

  return envValue
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

// 汇总所有版本检查地址
function getVersionCheckUrls(): string[] {
  const merged = new Set<string>();

  parseEnvVersionUrls().forEach((url) => merged.add(url));
  parseRuntimeVersionUrls().forEach((url) => merged.add(url));

  return Array.from(merged);
}

/**
 * 检查是否有新版本可用
 * @returns Promise<UpdateStatus> - 返回版本检查状态
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  const versionCheckUrls = getVersionCheckUrls();

  if (versionCheckUrls.length === 0) {
    console.info('未配置版本检查 URL，跳过远程版本检查');
    return UpdateStatus.FETCH_FAILED;
  }

  try {
    for (const url of versionCheckUrls) {
      const remoteVersion = await fetchVersionFromUrl(url);
      if (remoteVersion) {
        return compareVersions(remoteVersion);
      }
    }

    // 如果所有 URL 都无法获取版本信息，返回获取失败状态
    return UpdateStatus.FETCH_FAILED;
  } catch (error) {
    console.error('版本检查失败:', error);
    return UpdateStatus.FETCH_FAILED;
  }
}

/**
 * 从指定URL获取版本信息
 * @param url - 版本信息URL
 * @returns Promise<string | null> - 版本字符串或null
 */
async function fetchVersionFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

    // 添加时间戳参数以避免缓存
    const timestamp = Date.now();
    const urlWithTimestamp = url.includes('?')
      ? `${url}&_t=${timestamp}`
      : `${url}?_t=${timestamp}`;

    const response = await fetch(urlWithTimestamp, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const version = await response.text();
    return version.trim();
  } catch (error) {
    console.warn(`从 ${url} 获取版本信息失败:`, error);
    return null;
  }
}

/**
 * 比较版本号
 * @param remoteVersion - 远程版本号
 * @returns UpdateStatus - 返回版本比较结果
 */
export function compareVersions(remoteVersion: string): UpdateStatus {
  // 如果版本号相同，无需更新
  if (remoteVersion === CURRENT_VERSION) {
    return UpdateStatus.NO_UPDATE;
  }

  try {
    // 解析版本号为数字数组 [X, Y, Z]
    const currentParts = CURRENT_VERSION.split('.').map((part) => {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`无效的版本号格式: ${CURRENT_VERSION}`);
      }
      return num;
    });

    const remoteParts = remoteVersion.split('.').map((part) => {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`无效的版本号格式: ${remoteVersion}`);
      }
      return num;
    });

    // 标准化版本号到3个部分
    const normalizeVersion = (parts: number[]) => {
      if (parts.length >= 3) {
        return parts.slice(0, 3); // 取前三个元素
      } else {
        // 不足3个的部分补0
        const normalized = [...parts];
        while (normalized.length < 3) {
          normalized.push(0);
        }
        return normalized;
      }
    };

    const normalizedCurrent = normalizeVersion(currentParts);
    const normalizedRemote = normalizeVersion(remoteParts);

    // 逐级比较版本号
    for (let i = 0; i < 3; i++) {
      if (normalizedRemote[i] > normalizedCurrent[i]) {
        return UpdateStatus.HAS_UPDATE;
      } else if (normalizedRemote[i] < normalizedCurrent[i]) {
        return UpdateStatus.NO_UPDATE;
      }
      // 如果当前级别相等，继续比较下一级
    }

    // 所有级别都相等，无需更新
    return UpdateStatus.NO_UPDATE;
  } catch (error) {
    console.error('版本号比较失败:', error);
    // 如果版本号格式无效，回退到字符串比较
    return remoteVersion !== CURRENT_VERSION
      ? UpdateStatus.HAS_UPDATE
      : UpdateStatus.NO_UPDATE;
  }
}
