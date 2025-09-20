import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import type { AdminConfig } from '@/lib/admin.types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const config = await getConfig();
    const allSources: AdminConfig['SourceConfig'] = config.SourceConfig || [];
    const sources = allSources
      .filter((s) => !s.disabled && Boolean(s.api?.trim()))
      .map((s) => ({ key: s.key, name: s.name, api: s.api }));

    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json({ error: '获取源列表失败' }, { status: 500 });
  }
}
