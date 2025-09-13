/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { API_CONFIG, getAvailableApiSites,getCacheTime } from '@/lib/config';
import { SearchResult } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const typeId = searchParams.get('type_id');

  if (!sourceKey) {
    return NextResponse.json(
      { code: 400, message: '缺少必要参数: source' },
      { status: 400 }
    );
  }

  if (page < 1 || limit < 1 || limit > 100) {
    return NextResponse.json(
      { code: 400, message: '参数格式错误' },
      { status: 400 }
    );
  }

  try {
    const apiSites = await getAvailableApiSites(authInfo.username);
    const apiSite = apiSites.find((site) => site.key === sourceKey);

    if (!apiSite) {
      return NextResponse.json(
        { code: 404, message: '视频源不存在' },
        { status: 404 }
      );
    }

    // 构建请求URL
    let apiUrl = `${apiSite.api}?ac=videolist&pg=${page}`;
    if (typeId) {
      apiUrl += `&t=${typeId}`;
    }

    console.log(`正在获取视频列表: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: API_CONFIG.search.headers,
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.list)) {
      return NextResponse.json({
        code: 500,
        message: '该视频源返回格式错误',
        data: [],
        pagecount: 1,
      });
    }

    // 转换为统一格式
    const results: SearchResult[] = data.list.map((item: any) => {
      // 解析播放地址数组
      const playUrls = item.vod_play_url || '';
      const episodes = playUrls
        .split('#')
        .filter((url: string) => url.trim())
        .map((episode: string) => {
          const parts = episode.split('$');
          return parts.length > 1 ? parts[1] : episode;
        });

      const episodeTitles = playUrls
        .split('#')
        .filter((url: string) => url.trim())
        .map((episode: string) => {
          const parts = episode.split('$');
          return parts.length > 1 ? parts[0] : `第${episodes.indexOf(episode) + 1}集`;
        });

      return {
        id: item.vod_id?.toString() || '',
        title: item.vod_name || '',
        poster: item.vod_pic || '',
        episodes,
        episodes_titles: episodeTitles,
        source: apiSite.key,
        source_name: apiSite.name,
        year: item.vod_year || '',
        class: item.type_name || '',
        desc: item.vod_content || item.vod_blurb || '',
        type_name: item.type_name || '',
      };
    });

    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: results,
        page,
        pagecount: data.pagecount || 1,
        limit,
        total: data.total || 0,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    console.error('获取视频列表失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取视频列表失败',
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}