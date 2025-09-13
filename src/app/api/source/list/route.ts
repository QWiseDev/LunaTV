/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

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

    // 转换为源浏览器需要的格式
    const sources = apiSites.map((site) => ({
      key: site.key,
      name: site.name,
      api: site.api,
    }));

    return NextResponse.json({
      code: 200,
      message: '获取成功',
      data: sources,
    });
  } catch (error) {
    console.error('获取视频源列表失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取视频源列表失败',
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}