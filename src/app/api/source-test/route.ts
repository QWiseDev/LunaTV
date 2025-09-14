import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { API_CONFIG } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const sourceKey = searchParams.get('source');

  if (!query || !sourceKey) {
    return NextResponse.json(
      { error: '缺少必要参数: q (查询关键词) 和 source (源标识)' },
      { status: 400 }
    );
  }

  try {
    const config = await getConfig();
    
    // 查找指定的源（包括禁用的源）
    const targetSource = config.SourceConfig.find((s: any) => s.key === sourceKey);
    if (!targetSource) {
      return NextResponse.json(
        { error: `未找到源: ${sourceKey}` },
        { status: 404 }
      );
    }

    // 构建搜索URL
    const searchUrl = `${targetSource.api}?ac=list&wd=${encodeURIComponent(query)}`;
    
    // 直接请求源接口，不使用缓存
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

    try {
      const response = await fetch(searchUrl, {
        headers: API_CONFIG.search.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          { 
            error: `源接口返回错误: HTTP ${response.status}`,
            sourceError: `${response.status} ${response.statusText}`,
            sourceUrl: searchUrl
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      // 检查接口返回的数据格式
      if (!data || typeof data !== 'object') {
        return NextResponse.json(
          { 
            error: '源接口返回数据格式错误',
            sourceError: '返回数据不是有效的JSON对象',
            sourceUrl: searchUrl
          },
          { status: 502 }
        );
      }

      // 检查是否有错误信息
      if (data.code && data.code !== 1) {
        return NextResponse.json(
          { 
            error: `源接口返回错误: ${data.msg || '未知错误'}`,
            sourceError: data.msg || `错误代码: ${data.code}`,
            sourceUrl: searchUrl
          },
          { status: 502 }
        );
      }

      // 提取搜索结果
      const results = data.list || data.data || [];
      
      return NextResponse.json({
        success: true,
        source: sourceKey,
        sourceName: targetSource.name || sourceKey,
        sourceUrl: searchUrl,
        results: results,
        total: results.length,
        disabled: targetSource.disabled || false
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            error: '请求超时 (15秒)',
            sourceError: '连接超时',
            sourceUrl: searchUrl
          },
          { status: 408 }
        );
      }

      return NextResponse.json(
        { 
          error: `网络请求失败: ${fetchError.message}`,
          sourceError: fetchError.message,
          sourceUrl: searchUrl
        },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error('源测试API错误:', error);
    return NextResponse.json(
      { 
        error: `服务器内部错误: ${error.message}`,
        sourceError: error.message
      },
      { status: 500 }
    );
  }
}