import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 服务端专用函数，直接调用外部API
async function getShortDramaCategoriesInternal() {
  const response = await fetch('https://api.r2afosne.dpdns.org/vod/categories', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const categories = data.categories || [];
  return categories.map((item: any) => ({
    type_id: item.type_id,
    type_name: item.type_name,
  }));
}

export async function GET() {
  try {
    const categories = await getShortDramaCategoriesInternal();

    // 设置与网页端一致的缓存策略（categories: 4小时）
    const response = NextResponse.json(categories);

    console.log('🕐 [CATEGORIES] 设置4小时HTTP缓存 - 与网页端categories缓存一致');

    // 4小时 = 14400秒（与网页端SHORTDRAMA_CACHE_EXPIRE.categories一致）
    const cacheTime = 14400;
    response.headers.set('Cache-Control', `public, max-age=${cacheTime}, s-maxage=${cacheTime}`);
    response.headers.set('CDN-Cache-Control', `public, s-maxage=${cacheTime}`);
    response.headers.set('Vercel-CDN-Cache-Control', `public, s-maxage=${cacheTime}`);

    // 调试信息
    response.headers.set('X-Cache-Duration', '4hour');
    response.headers.set('X-Cache-Expires-At', new Date(Date.now() + cacheTime * 1000).toISOString());
    response.headers.set('X-Debug-Timestamp', new Date().toISOString());

    // Vary头确保不同设备有不同缓存
    response.headers.set('Vary', 'Accept-Encoding, User-Agent');

    return response;
  } catch (error) {
    console.error('获取短剧分类失败:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}