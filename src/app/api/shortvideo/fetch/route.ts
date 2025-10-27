import { NextResponse } from 'next/server';

/**
 * GET /api/shortvideo/fetch - 获取短视频地址
 * 该接口会请求外部API，该API会重定向到真实的视频地址
 */
export async function GET() {
  try {
    const apiUrl = 'http://api.yujn.cn/api/zzxjj.php?type=video';
    
    // 使用 fetch 请求，允许重定向
    const response = await fetch(apiUrl, {
      redirect: 'follow', // 跟随重定向
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // 获取最终的URL（重定向后的地址）
    const videoUrl = response.url;

    return NextResponse.json({
      success: true,
      url: videoUrl,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('获取短视频地址失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取视频地址失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
