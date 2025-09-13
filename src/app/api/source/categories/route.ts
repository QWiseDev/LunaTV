/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { API_CONFIG, getAvailableApiSites,getCacheTime } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');

  if (!sourceKey) {
    return NextResponse.json(
      { code: 400, message: '缺少必要参数: source' },
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

    // 获取分类列表
    const categoriesUrl = `${apiSite.api}?ac=list`;
    console.log(`正在获取分类列表: ${categoriesUrl}`);

    const response = await fetch(categoriesUrl, {
      headers: API_CONFIG.search.headers,
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.class) {
      return NextResponse.json({
        code: 500,
        message: '该视频源不支持分类或返回格式错误',
        data: [],
      });
    }

    // 解析分类数据
    const categories = data.class.map((category: any) => ({
      type_id: category.type_id,
      type_name: category.type_name,
      type_pid: category.type_pid || 0,
    }));

    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: categories,
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
    console.error('获取分类列表失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取分类列表失败',
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}