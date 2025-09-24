/* eslint-disable no-constant-condition */

import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";

const defaultUA = 'AptvPlayer/1.4.10'

export interface LiveChannels {
  channelNumber: number;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
  epgUrl: string;
  epgs: {
    [key: string]: {
      start: string;
      end: string;
      title: string;
    }[];
  };
}

const cachedLiveChannels: { [key: string]: LiveChannels } = {};

export function deleteCachedLiveChannels(key: string) {
  delete cachedLiveChannels[key];
}

export async function getCachedLiveChannels(key: string): Promise<LiveChannels | null> {
  if (!cachedLiveChannels[key]) {
    const config = await getConfig();
    const liveInfo = config.LiveConfig?.find(live => live.key === key);
    if (!liveInfo) {
      return null;
    }
    const channelNum = await refreshLiveChannels(liveInfo);
    if (channelNum === 0) {
      return null;
    }
    liveInfo.channelNumber = channelNum;
    await db.saveAdminConfig(config);
  }
  return cachedLiveChannels[key] || null;
}

export async function refreshLiveChannels(liveInfo: {
  key: string;
  name: string;
  url: string;
  ua?: string;
  epg?: string;
  from: 'config' | 'custom';
  channelNumber?: number;
  disabled?: boolean;
}): Promise<number> {
  if (cachedLiveChannels[liveInfo.key]) {
    delete cachedLiveChannels[liveInfo.key];
  }
  const ua = liveInfo.ua || defaultUA;
  const response = await fetch(liveInfo.url, {
    headers: {
      'User-Agent': ua,
    },
  });
  const data = await response.text();
  const result = parseM3U(liveInfo.key, data);
  const epgUrl = liveInfo.epg || result.tvgUrl;
  
  // 提取有效的 tvg-id
  const tvgIds = result.channels.map(channel => channel.tvgId).filter(tvgId => tvgId && tvgId.trim());
  
  // 如果没有 tvg-id，尝试使用频道名称作为备选
  const fallbackIds = tvgIds.length === 0 
    ? result.channels.map(channel => channel.name).filter(name => name && name.trim())
    : tvgIds;
  
  const epgs = await parseEpg(epgUrl, liveInfo.ua || defaultUA, fallbackIds);
  cachedLiveChannels[liveInfo.key] = {
    channelNumber: result.channels.length,
    channels: result.channels,
    epgUrl: epgUrl,
    epgs: epgs,
  };
  return result.channels.length;
}

// 智能匹配 tvg-id 的函数
function createTvgIdMatcher(tvgIds: string[]) {
  const exactMatch = new Set(tvgIds);
  const normalizedMap = new Map<string, string>();
  
  // 创建标准化映射
  tvgIds.forEach(tvgId => {
    // 移除特殊字符和空格，转为小写
    const normalized = tvgId.toLowerCase()
      .replace(/[-_\s财经高清卫视电视台]/g, '')
      .replace(/cctv(\d+)/g, 'cctv$1'); // 保持CCTV数字格式
    normalizedMap.set(normalized, tvgId);
  });
  
  return {
    // 精确匹配
    hasExact: (channelId: string) => exactMatch.has(channelId),
    
    // 智能匹配
    findMatch: (channelId: string): string | null => {
      // 1. 先尝试精确匹配
      if (exactMatch.has(channelId)) {
        return channelId;
      }
      
      // 2. 尝试标准化匹配
      const normalizedChannel = channelId.toLowerCase()
        .replace(/[-_\s卫视电视台]/g, '')
        .replace(/cctv(\d+)/g, 'cctv$1');
      
      // 查找最佳匹配
      const entries = Array.from(normalizedMap.entries());
      for (const [normalizedTvg, originalTvg] of entries) {
        // 完全匹配
        if (normalizedTvg === normalizedChannel) {
          return originalTvg;
        }
        
        // 部分匹配：处理常见的频道名称变体
        // 例如：北京卫视 <-> 北京 或 BTV <-> 北京卫视
        if (normalizedTvg.length >= 2 && normalizedChannel.length >= 2) {
          if (normalizedTvg.includes(normalizedChannel) || normalizedChannel.includes(normalizedTvg)) {
            return originalTvg;
          }
          
          // 特殊处理：卫视频道
          if (normalizedChannel.includes('卫视') || normalizedTvg.includes('卫视')) {
            const channelCore = normalizedChannel.replace(/卫视/g, '');
            const tvgCore = normalizedTvg.replace(/卫视/g, '');
            if (channelCore && tvgCore && (channelCore.includes(tvgCore) || tvgCore.includes(channelCore))) {
              return originalTvg;
            }
          }
        }
      }
      
      return null;
    }
  };
}

async function parseEpg(epgUrl: string, ua: string, tvgIds: string[]): Promise<{
  [key: string]: {
    start: string;
    end: string;
    title: string;
  }[]
}> {
  if (!epgUrl) {
    return {};
  }

  // 创建智能匹配器
  const matcher = createTvgIdMatcher(tvgIds);
  const result: { [key: string]: { start: string; end: string; title: string }[] } = {};
  const channelMapping = new Map<string, string>(); // EPG频道ID -> M3U tvg-id 的映射

  try {
    const response = await fetch(epgUrl, {
      headers: {
        'User-Agent': ua,
      },
      // 添加超时设置
      signal: AbortSignal.timeout(30000) // 30秒超时
    });
    
    if (!response.ok) {
      return {};
    }

    // 使用 ReadableStream 逐行处理，避免将整个文件加载到内存
    const reader = response.body?.getReader();
    if (!reader) {
      return {};
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEpgChannelId = '';
    let currentMappedTvgId = '';
    let currentProgram: { start: string; end: string; title: string } | null = null;
    let shouldSkipCurrentProgram = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // 保留最后一行（可能不完整）
      buffer = lines.pop() || '';

      // 处理完整的行
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 解析 <channel> 标签，建立映射关系
        if (trimmedLine.startsWith('<channel id="')) {
          const channelIdMatch = trimmedLine.match(/id="([^"]*)"/);
          if (channelIdMatch) {
            const epgChannelId = channelIdMatch[1];
            const matchedTvgId = matcher.findMatch(epgChannelId);
            
            if (matchedTvgId) {
              channelMapping.set(epgChannelId, matchedTvgId);
            }
          }
        }
        // 解析 <programme> 标签
        else if (trimmedLine.startsWith('<programme')) {
          // 提取 channel 属性（EPG中的频道ID）
          const channelMatch = trimmedLine.match(/channel="([^"]*)"/);
          currentEpgChannelId = channelMatch ? channelMatch[1] : '';
          
          // 查找对应的 M3U tvg-id
          currentMappedTvgId = channelMapping.get(currentEpgChannelId) || '';

          // 提取开始时间
          const startMatch = trimmedLine.match(/start="([^"]*)"/);
          const start = startMatch ? startMatch[1] : '';

          // 提取结束时间
          const endMatch = trimmedLine.match(/stop="([^"]*)"/);
          const end = endMatch ? endMatch[1] : '';

          if (currentMappedTvgId && start && end) {
            currentProgram = { start, end, title: '' };
            shouldSkipCurrentProgram = false;
          } else {
            shouldSkipCurrentProgram = true;
          }
        }
        // 解析 <title> 标签 - 只有在需要解析当前节目时才处理
        else if (trimmedLine.startsWith('<title') && currentProgram && !shouldSkipCurrentProgram && currentMappedTvgId) {
          // 处理带有语言属性的title标签，如 <title lang="zh">远方的家2025-60</title>
          const titleMatch = trimmedLine.match(/<title(?:\s+[^>]*)?>(.*?)<\/title>/);
          if (titleMatch && currentProgram) {
            currentProgram.title = titleMatch[1];

            // 使用映射后的 M3U tvg-id 作为键
            if (!result[currentMappedTvgId]) {
              result[currentMappedTvgId] = [];
            }
            result[currentMappedTvgId].push({ ...currentProgram });

            currentProgram = null;
          }
        }
        // 处理 </programme> 标签
        else if (trimmedLine === '</programme>') {
          currentProgram = null;
          currentEpgChannelId = '';
          currentMappedTvgId = '';
          shouldSkipCurrentProgram = false; // 重置跳过标志
        }
      }
    }

  } catch (error) {
    return {};
  }

  return result;
}

/**
 * 解析M3U文件内容，提取频道信息
 * @param m3uContent M3U文件的内容字符串
 * @returns 频道信息数组
 */
function parseM3U(sourceKey: string, m3uContent: string): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
} {
  const channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[] = [];

  const lines = m3uContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let tvgUrl = '';
  let channelIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否是 #EXTM3U 行，提取 tvg-url
    if (line.startsWith('#EXTM3U')) {
      // 支持两种格式：x-tvg-url 和 url-tvg
      const tvgUrlMatch = line.match(/(?:x-tvg-url|url-tvg)="([^"]*)"/);
      tvgUrl = tvgUrlMatch ? tvgUrlMatch[1].split(',')[0].trim() : '';
      continue;
    }

    // 检查是否是 #EXTINF 行
    if (line.startsWith('#EXTINF:')) {
      // 提取 tvg-id
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgId = tvgIdMatch ? tvgIdMatch[1] : '';

      // 提取 tvg-name
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgName = tvgNameMatch ? tvgNameMatch[1] : '';

      // 提取 tvg-logo
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const logo = tvgLogoMatch ? tvgLogoMatch[1] : '';

      // 提取 group-title
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      const group = groupTitleMatch ? groupTitleMatch[1] : '无分组';

      // 提取标题（#EXTINF 行最后的逗号后面的内容）
      const titleMatch = line.match(/,([^,]*)$/);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // 优先使用 tvg-name，如果没有则使用标题
      const name = title || tvgName || '';

      // 检查下一行是否是URL
      if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        const url = lines[i + 1];

        // 只有当有名称和URL时才添加到结果中
        if (name && url) {
          channels.push({
            id: `${sourceKey}-${channelIndex}`,
            tvgId,
            name,
            logo,
            group,
            url
          });
          channelIndex++;
        }

        // 跳过下一行，因为已经处理了
        i++;
      }
    }
  }

  return { tvgUrl, channels };
}

// utils/urlResolver.js
export function resolveUrl(baseUrl: string, relativePath: string) {
  try {
    // 如果已经是完整的 URL，直接返回
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }

    // 如果是协议相对路径 (//example.com/path)
    if (relativePath.startsWith('//')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}${relativePath}`;
    }

    // 使用 URL 构造函数处理相对路径
    const baseUrlObj = new URL(baseUrl);
    const resolvedUrl = new URL(relativePath, baseUrlObj);
    return resolvedUrl.href;
  } catch (error) {
    // 降级处理
    return fallbackUrlResolve(baseUrl, relativePath);
  }
}

function fallbackUrlResolve(baseUrl: string, relativePath: string) {
  // 移除 baseUrl 末尾的文件名，保留目录路径
  let base = baseUrl;
  if (!base.endsWith('/')) {
    base = base.substring(0, base.lastIndexOf('/') + 1);
  }

  // 处理不同类型的相对路径
  if (relativePath.startsWith('/')) {
    // 绝对路径 (/path/to/file)
    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}${relativePath}`;
  } else if (relativePath.startsWith('../')) {
    // 上级目录相对路径 (../path/to/file)
    const segments = base.split('/').filter(s => s);
    const relativeSegments = relativePath.split('/').filter(s => s);

    for (const segment of relativeSegments) {
      if (segment === '..') {
        segments.pop();
      } else if (segment !== '.') {
        segments.push(segment);
      }
    }

    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}/${segments.join('/')}`;
  } else {
    // 当前目录相对路径 (file.ts 或 ./file.ts)
    const cleanRelative = relativePath.startsWith('./') ? relativePath.slice(2) : relativePath;
    return base + cleanRelative;
  }
}

// 获取 M3U8 的基础 URL
export function getBaseUrl(m3u8Url: string) {
  try {
    const url = new URL(m3u8Url);
    // 如果 URL 以 .m3u8 结尾，移除文件名
    if (url.pathname.endsWith('.m3u8')) {
      url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
    } else if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    return url.protocol + "//" + url.host + url.pathname;
  } catch (error) {
    return m3u8Url.endsWith('/') ? m3u8Url : m3u8Url + '/';
  }
}