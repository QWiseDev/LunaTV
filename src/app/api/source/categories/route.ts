import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');

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

    // 调用视频源的分类 API
    const apiUrl = `${targetSite.api}?ac=list`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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

    if (!data || !data.class || !Array.isArray(data.class)) {
      return NextResponse.json(
        {
          code: 500,
          message: '视频源返回的数据格式错误',
          data: [],
        },
        { status: 500 }
      );
    }

    // 处理分类数据
    const categories = data.class.map(
      (category: {
        type_id: string;
        type_name: string;
        type_pid?: number;
      }) => ({
        type_id: category.type_id,
        type_name: category.type_name,
        type_pid: category.type_pid || 0,
      })
    );

    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: categories,
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
    console.error(`获取视频源 ${sourceKey} 分类失败:`, {
      sourceKey,
      error: errorMessage,
      isTimeout,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        code: 500,
        message: isTimeout ? '请求超时，该视频源可能无法访问' : '获取分类失败',
        data: [],
        debug: {
          error: errorMessage,
          isTimeout,
          sourceKey,
        },
      },
      { status: 500 }
    );
  }
}