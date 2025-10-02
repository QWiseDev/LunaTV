import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiSites = await getAvailableApiSites(authInfo.username);

    // 只返回必要的字段，避免敏感信息泄露
    const sources = apiSites.map((site) => ({
      key: site.key,
      name: site.name,
    }));

    return NextResponse.json(sources, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5分钟缓存
      },
    });
  } catch (error) {
    console.error('获取数据源列表失败:', error);
    return NextResponse.json({ error: '获取数据源列表失败' }, { status: 500 });
  }
}
