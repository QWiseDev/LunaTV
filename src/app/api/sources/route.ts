import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const config = await getConfig();
    
    // 获取所有源配置（包括禁用的）
    const allSources = config.SourceConfig || [];
    
    const sources = allSources.map((source: any) => ({
      key: source.key,
      name: source.name || source.key,
      api: source.api || '',
      disabled: source.disabled || false
    }));
    
    return NextResponse.json({ sources });
  } catch (error) {
    console.error('获取源配置失败:', error);
    return NextResponse.json(
      { error: '获取源配置失败' },
      { status: 500 }
    );
  }
}