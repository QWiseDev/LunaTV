/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { parseShortDramaEpisode } from '@/lib/shortdrama.client';

// 标记为动态路由
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const episode = searchParams.get('episode');

    if (!id) {
      return NextResponse.json(
        { error: '缺少必要参数: id' },
        { status: 400 }
      );
    }

    const videoId = parseInt(id);
    const episodeNum = episode ? parseInt(episode) : 1;

    if (isNaN(videoId) || isNaN(episodeNum)) {
      return NextResponse.json(
        { error: '参数格式错误' },
        { status: 400 }
      );
    }

    // 先尝试指定集数
    let result = await parseShortDramaEpisode(videoId, episodeNum, true);

    // 如果失败，尝试其他集数
    if (result.code !== 0 || !result.data || !result.data.totalEpisodes) {
      result = await parseShortDramaEpisode(videoId, episodeNum === 1 ? 2 : 1, true);
    }

    // 如果还是失败，尝试第0集
    if (result.code !== 0 || !result.data || !result.data.totalEpisodes) {
      result = await parseShortDramaEpisode(videoId, 0, true);
    }

    if (result.code !== 0 || !result.data) {
      return NextResponse.json(
        { error: result.msg || '解析失败' },
        { status: 400 }
      );
    }

    const totalEpisodes = Math.max(result.data.totalEpisodes || 1, 1);

    // 转换为兼容格式
    const response = {
      id: result.data!.videoId.toString(),
      title: result.data!.videoName,
      poster: result.data!.cover,
      episodes: Array.from({ length: totalEpisodes }, (_, i) =>
        `shortdrama:${result.data!.videoId}:${i}` // API实际使用0-based索引
      ),
      episodes_titles: Array.from({ length: totalEpisodes }, (_, i) =>
        `第${i + 1}集`
      ),
      source: 'shortdrama',
      source_name: '短剧',
      year: new Date().getFullYear().toString(),
      desc: result.data!.description,
      type_name: '短剧',
    };

    // 设置与豆瓣一致的缓存策略
    const cacheTime = await getCacheTime();
    const finalResponse = NextResponse.json(response);
    finalResponse.headers.set('Cache-Control', `public, max-age=${cacheTime}, s-maxage=${cacheTime}`);
    finalResponse.headers.set('CDN-Cache-Control', `public, s-maxage=${cacheTime}`);
    finalResponse.headers.set('Vercel-CDN-Cache-Control', `public, s-maxage=${cacheTime}`);
    finalResponse.headers.set('Netlify-Vary', 'query');

    return finalResponse;
  } catch (error) {
    console.error('短剧详情获取失败:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}