import { NextRequest, NextResponse } from 'next/server';

import { getAdminRoleFromRequest } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const role = await getAdminRoleFromRequest(request);
    if (!role) {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    return NextResponse.json({ role });
  } catch (error) {
    return NextResponse.json(
      { error: '获取权限信息失败' },
      { status: 500 }
    );
  }
}
