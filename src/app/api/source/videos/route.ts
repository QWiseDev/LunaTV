import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

export const runtime = 'nodejs';

interface VideoItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');
  const typeId = searchParams.get('type_id'); // 可以为空，表示获取全部
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // 验证用户身份
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!sourceKey) {
      return NextResponse.json(
        {
          code: 400,
          message: '缺少 source 参数',
          data: [],
        },
        { status: 400 }
      );
    }

    // 获取可用的 API 站点
    const apiSites = await getAvailableApiSites(authInfo.username);
    const targetSite = apiSites.find((site) => site.key === sourceKey);

    if (!targetSite) {
      return NextResponse.json(
        {
          code: 404,
          message: '未找到指定的视频源',
          data: [],
        },
        { status: 404 }
      );
    }

    // 构建API URL
    let apiUrl = `${targetSite.api}?ac=videolist&pg=${page}&limit=${limit}`;
    if (typeId && typeId !== 'all') {
      apiUrl += `&t=${typeId}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.list || !Array.isArray(data.list)) {
      return NextResponse.json(
        {
          code: 500,
          message: '视频源返回的数据格式错误',
          data: [],
          pagecount: 0,
        },
        { status: 500 }
      );
    }

    // 转换数据格式
    const videos: SearchResult[] = data.list.map((item: VideoItem) => {
      const episodes: string[] = [];
      const titles: string[] = [];

      if (item.vod_play_url) {
        try {
          const playDataParts = item.vod_play_url.split('$$$');
          if (playDataParts.length > 0) {
            const firstPart = playDataParts[0];
            const episodeInfos = firstPart.split('#').filter(Boolean);
            episodeInfos.forEach((info) => {
              const [title, url] = info.split('$');
              if (title && url) {
                episodes.push(url);
                titles.push(title);
              }
            });
          }
        } catch (error) {
          console.error('解析播放链接失败:', error);
        }
      }

      return {
        id: item.vod_id,
        title: cleanHtmlTags(item.vod_name),
        poster: item.vod_pic || '',
        episodes,
        episodes_titles: titles,
        source: sourceKey,
        source_name: targetSite.name,
        class: item.vod_class || '',
        year: item.vod_year || 'unknown',
        desc: cleanHtmlTags(item.vod_content || ''),
        type_name: item.type_name || '',
        douban_id: item.vod_douban_id,
      };
    });

    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: videos,
        page: data.page || page,
        pagecount: data.pagecount || 1,
        total: data.total || videos.length,
        source: targetSite.name,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const isTimeout =
      errorMessage.includes('abort') || errorMessage.includes('timeout');

    // eslint-disable-next-line no-console
    console.error(`获取视频源 ${sourceKey} 视频列表失败:`, {
      sourceKey,
      typeId,
      page,
      error: errorMessage,
      isTimeout,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        code: 500,
        message: isTimeout ? '请求超时，该视频源可能无法访问' : '获取视频列表失败',
        data: [],
        pagecount: 0,
        debug: {
          error: errorMessage,
          isTimeout,
          sourceKey,
          typeId,
          page,
        },
      },
      { status: 500 }
    );
  }
}