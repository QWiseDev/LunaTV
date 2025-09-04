import { NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    // 验证用户身份
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取可用的 API 站点
    const apiSites = await getAvailableApiSites(authInfo.username);

    const sources = apiSites.map((site) => ({
      key: site.key,
      name: site.name,
      api: site.api,
      detail: site.detail,
    }));

    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: sources,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('获取视频源列表失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取视频源列表失败',
        data: [],
      },
      { status: 500 }
    );
  }
}