import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, hasSpecialFeaturePermission } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
}

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    
    // 检查用户权限
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;

    // 获取配置检查AI功能是否启用
    const adminConfig = await getConfig();

    // 检查用户是否有AI推荐功能权限（传入已获取的配置避免重复调用）
    const hasPermission = await hasSpecialFeaturePermission(username, 'ai-recommend', adminConfig);
    if (!hasPermission) {
      return NextResponse.json({
        error: '您无权使用AI推荐功能，请联系管理员开通权限'
      }, {
        status: 403,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Expires': '0',
          'Pragma': 'no-cache',
          'Surrogate-Control': 'no-store'
        }
      });
    }
    const aiConfig = adminConfig.AIRecommendConfig;

    if (!aiConfig?.enabled) {
      return NextResponse.json({
        error: 'AI推荐功能未启用'
      }, {
        status: 403,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Expires': '0',
          'Pragma': 'no-cache',
          'Surrogate-Control': 'no-store'
        }
      });
    }

    // 检查API配置是否完整
    if (!aiConfig.apiKey || !aiConfig.apiUrl) {
      return NextResponse.json({ 
        error: 'AI推荐功能配置不完整，请联系管理员' 
      }, { status: 500 });
    }

    const { messages, model, temperature, max_tokens, max_completion_tokens } = await request.json() as ChatRequest;

    // 验证请求格式
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ 
        error: 'Invalid messages format' 
      }, { status: 400 });
    }

    // 优化缓存策略 - 只对简单的单轮问答进行短时缓存
    let cacheKey: string | null = null;
    let cachedResponse = null;
    
    // 只有在单轮对话且消息较短时才使用缓存，避免过度缓存复杂对话
    if (messages.length === 1 && messages[0].role === 'user' && messages[0].content.length < 50) {
      const questionHash = Buffer.from(messages[0].content.trim().toLowerCase()).toString('base64').slice(0, 16);
      cacheKey = `ai-recommend-simple-${questionHash}`;
      cachedResponse = await db.getCache(cacheKey);
    }
    
    if (cachedResponse) {
      return NextResponse.json(cachedResponse);
    }

    // 结合当前日期的结构化推荐系统提示词
    const currentDate = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const randomElements = [
      '尝试推荐一些不同类型的作品',
      '可以包含一些经典和新作品的混合推荐', 
      '考虑推荐一些口碑很好的作品',
      '可以推荐一些最近讨论度比较高的作品'
    ];
    const randomHint = randomElements[Math.floor(Math.random() * randomElements.length)];
    
    // 获取最后一条用户消息用于分析
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // 检测用户消息中的YouTube链接
    const detectVideoLinks = (content: string) => {
      const youtubePattern = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]+)/g;
      const matches = [];
      let match;
      while ((match = youtubePattern.exec(content)) !== null) {
        matches.push({
          originalUrl: match[0],
          videoId: match[1],
          fullMatch: match[0]
        });
      }
      return matches;
    };

    // 检查是否包含YouTube链接
    const videoLinks = detectVideoLinks(userMessage);
    const hasVideoLinks = videoLinks.length > 0;

    // 获取YouTube配置，判断是否启用YouTube推荐功能
    const youtubeConfig = adminConfig.YouTubeConfig;
    const youtubeEnabled = youtubeConfig?.enabled;

    // 构建功能列表和详细说明
    const capabilities = ['影视剧推荐'];
    let youtubeSearchStatus = '';
    
    // 视频链接解析功能（所有用户可用）
    capabilities.push('YouTube视频链接解析');
    
    // YouTube推荐功能状态判断
    if (youtubeEnabled && youtubeConfig.apiKey) {
      capabilities.push('YouTube视频搜索推荐');
      youtubeSearchStatus = '✅ 支持YouTube视频搜索推荐（真实API）';
    } else if (youtubeEnabled) {
      youtubeSearchStatus = '⚠️ YouTube搜索功能已开启但未配置API Key，无法提供搜索结果';
    } else {
      youtubeSearchStatus = '❌ YouTube搜索功能未启用，无法搜索推荐YouTube视频';
    }

    const systemPrompt = `你是LunaTV的智能推荐助手，支持：${capabilities.join('、')}。当前日期：${currentDate}

## 功能状态：
1. **影视剧推荐** ✅ 始终可用
2. **YouTube视频链接解析** ✅ 始终可用（无需API Key）
3. **YouTube视频搜索推荐** ${youtubeSearchStatus}

## 判断用户需求：
- 如果用户发送了YouTube链接 → 使用视频链接解析功能
- 如果用户想要新闻、教程、音乐、娱乐视频等内容：
  ${youtubeEnabled && youtubeConfig.apiKey ? 
    '→ 使用YouTube推荐功能' : 
    '→ 告知用户"YouTube搜索功能暂不可用，请联系管理员配置YouTube API Key"'}
- 如果用户想要电影、电视剧、动漫等影视内容 → 使用影视推荐功能
- 其他无关内容 → 直接拒绝回答

## 回复格式要求：

### 影视推荐格式：
《片名》 (年份) [类型] - 简短描述

### 视频链接解析格式：
检测到用户发送了YouTube链接时，回复：
我识别到您发送了YouTube视频链接，正在为您解析视频信息...

${youtubeEnabled && youtubeConfig.apiKey ? `### YouTube推荐格式：
【视频标题】 - 简短描述

示例：
【如何学习编程】 - 适合初学者的编程入门教程
【今日新闻速报】 - 最新国际新闻资讯` : '### YouTube搜索不可用时的回复：\n当用户请求YouTube视频搜索时，请回复：\n"很抱歉，YouTube视频搜索功能暂不可用。管理员尚未配置YouTube API Key。\n\n不过您可以：\n- 直接发送YouTube链接给我解析\n- 让我为您推荐影视剧内容"'}

## 推荐要求：
- ${randomHint}
- 重点推荐${currentYear}年的最新作品
- 可以包含${lastYear}年的热门作品
- 避免推荐${currentYear-2}年以前的老作品，除非是经典必看
- 推荐内容要具体，包含作品名称、年份、类型、推荐理由
- 每次回复尽量提供一些新的角度或不同的推荐
- 避免推荐过于小众或难以找到的内容

格式限制：
- 严禁输出任何Markdown格式。
- "片名"必须是真实存在的影视作品的官方全名。
- "年份"必须是4位数字的公元年份。
- "类型"必须是该影片的主要类型，例如：剧情/悬疑/科幻。
- "简短描述"是对影片的简要介绍。
- 每一部推荐的影片都必须独占一行，并以《》开始。

请始终保持专业和有用的态度，根据用户输入的内容类型提供相应的服务。`;

    // 准备发送给OpenAI的消息
    const chatMessages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // 使用配置中的参数或请求参数
    const requestModel = model || aiConfig.model;
    let tokenLimit = max_tokens || max_completion_tokens || aiConfig.maxTokens;
    
    // 判断是否是需要使用max_completion_tokens的模型
    // o系列推理模型(o1,o3,o4等)和GPT-5系列使用max_completion_tokens
    const useMaxCompletionTokens = requestModel.startsWith('o1') || 
                                  requestModel.startsWith('o3') || 
                                  requestModel.startsWith('o4') ||
                                  requestModel.includes('gpt-5');
    
    // 根据搜索结果优化token限制，避免空回复
    if (useMaxCompletionTokens) {
      // 推理模型需要更高的token限制
      // GPT-5: 最大128,000, o3/o4-mini: 最大100,000
      if (requestModel.includes('gpt-5')) {
        tokenLimit = Math.max(tokenLimit, 2000); // GPT-5最小2000 tokens
        tokenLimit = Math.min(tokenLimit, 128000); // GPT-5最大128k tokens
      } else if (requestModel.startsWith('o3') || requestModel.startsWith('o4')) {
        tokenLimit = Math.max(tokenLimit, 1500); // o3/o4最小1500 tokens
        tokenLimit = Math.min(tokenLimit, 100000); // o3/o4最大100k tokens
      } else {
        tokenLimit = Math.max(tokenLimit, 1000); // 其他推理模型最小1000 tokens
      }
    } else {
      // 普通模型确保最小token数避免空回复
      tokenLimit = Math.max(tokenLimit, 500); // 最小500 tokens
      if (requestModel.includes('gpt-4')) {
        tokenLimit = Math.min(tokenLimit, 32768); // GPT-4系列最大32k tokens
      }
    }
    
    const requestBody: any = {
      model: requestModel,
      messages: chatMessages,
    };
    
    // 推理模型不支持某些参数
    if (!useMaxCompletionTokens) {
      requestBody.temperature = temperature ?? aiConfig.temperature;
    }
    
    // 根据模型类型使用正确的token限制参数
    if (useMaxCompletionTokens) {
      requestBody.max_completion_tokens = tokenLimit;
      // 推理模型不支持这些参数
      console.log(`使用推理模型 ${requestModel}，max_completion_tokens: ${tokenLimit}`);
    } else {
      requestBody.max_tokens = tokenLimit;
      console.log(`使用标准模型 ${requestModel}，max_tokens: ${tokenLimit}`);
    }

    // 调用AI API
    const openaiResponse = await fetch(aiConfig.apiUrl.endsWith('/chat/completions') 
      ? aiConfig.apiUrl 
      : `${aiConfig.apiUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API Error:', errorData);
      
      // 提供更详细的错误信息
      let errorMessage = 'AI服务暂时不可用，请稍后重试';
      let errorDetails = '';
      
      try {
        const parsedError = JSON.parse(errorData);
        if (parsedError.error?.message) {
          errorDetails = parsedError.error.message;
        }
      } catch {
        errorDetails = errorData.substring(0, 200); // 限制错误信息长度
      }
      
      // 根据HTTP状态码提供更具体的错误信息
      if (openaiResponse.status === 401) {
        errorMessage = 'API密钥无效，请联系管理员检查配置';
      } else if (openaiResponse.status === 429) {
        errorMessage = 'API请求频率限制，请稍后重试';
      } else if (openaiResponse.status === 400) {
        errorMessage = '请求参数错误，请检查输入内容';
      } else if (openaiResponse.status >= 500) {
        errorMessage = 'AI服务器错误，请稍后重试';
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: errorDetails,
        status: openaiResponse.status
      }, { status: 500 });
    }

    const aiResult = await openaiResponse.json();
    
    // 检查AI响应的完整性
    if (!aiResult.choices || aiResult.choices.length === 0 || !aiResult.choices[0].message) {
      console.error('AI响应格式异常:', aiResult);
      return NextResponse.json({ 
        error: 'AI服务响应格式异常，请稍后重试',
        details: `响应结构异常: ${JSON.stringify(aiResult).substring(0, 200)}...`
      }, { status: 500 });
    }
    
    const aiContent = aiResult.choices[0].message.content;
    
    // 处理视频链接解析
    if (hasVideoLinks) {
      try {
        const parsedVideos = await handleVideoLinkParsing(videoLinks);
        
        // 构建返回格式
        const response = {
          id: aiResult.id || `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: aiResult.created || Math.floor(Date.now() / 1000),
          model: aiResult.model || requestBody.model,
          choices: aiResult.choices || [{
            index: 0,
            message: {
              role: 'assistant',
              content: aiContent
            },
            finish_reason: aiResult.choices?.[0]?.finish_reason || 'stop'
          }],
          usage: aiResult.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },
          videoLinks: parsedVideos, // 添加解析的视频链接数据
          type: 'video_link_parse'
        };

        // 缓存结果（只对简单问题进行短时缓存，15分钟）
        if (cacheKey) {
          await db.setCache(cacheKey, response, 900); // 15分钟缓存
        }

        return NextResponse.json(response);
      } catch (error) {
        console.error('视频链接解析失败:', error);
        // 解析失败时继续正常流程
      }
    }
    
    // 检查内容是否为空
    if (!aiContent || aiContent.trim() === '') {
      console.error('AI返回空内容:', {
        model: requestModel,
        tokenLimit,
        useMaxCompletionTokens,
        choices: aiResult.choices,
        usage: aiResult.usage
      });
      
      let errorMessage = 'AI返回了空回复';
      let errorDetails = '';
      
      if (useMaxCompletionTokens) {
        // 推理模型特殊处理
        if (tokenLimit < 1000) {
          errorMessage = '推理模型token限制过低导致空回复';
          errorDetails = `当前设置：${tokenLimit} tokens。推理模型建议最少设置1500+ tokens，因为需要额外的推理token消耗。请在管理后台调整maxTokens参数。`;
        } else {
          errorMessage = '推理模型返回空内容';
          errorDetails = `模型：${requestModel}，token设置：${tokenLimit}。推理模型可能因为内容过滤或推理复杂度返回空内容。建议：1) 简化问题描述 2) 检查API密钥权限 3) 尝试增加token限制`;
        }
      } else {
        // 普通模型处理
        if (tokenLimit < 200) {
          errorMessage = 'Token限制过低导致空回复';
          errorDetails = `当前设置：${tokenLimit} tokens，建议至少500+ tokens。请在管理后台调整maxTokens参数。`;
        } else {
          errorDetails = '建议：请尝试更详细地描述您想要的影视类型或心情，或联系管理员检查AI配置';
        }
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: errorDetails,
        modelInfo: {
          model: requestModel,
          tokenLimit,
          isReasoningModel: useMaxCompletionTokens
        }
      }, { status: 500 });
    }
    
    // 检测是否为YouTube视频推荐（参考alpha逻辑）
    const isYouTubeRecommendation = youtubeEnabled && youtubeConfig.apiKey && aiContent.includes('【') && aiContent.includes('】');
    
    if (isYouTubeRecommendation) {
      try {
        const searchKeywords = extractYouTubeSearchKeywords(aiContent);
        const youtubeVideos = await searchYouTubeVideos(searchKeywords, youtubeConfig);
        
        // 构建YouTube推荐响应
        const response = {
          id: aiResult.id || `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: aiResult.created || Math.floor(Date.now() / 1000),
          model: aiResult.model || requestBody.model,
          choices: aiResult.choices || [{
            index: 0,
            message: {
              role: 'assistant',
              content: aiContent + (youtubeVideos.length > 0 ? `\n\n为您推荐以下${youtubeVideos.length}个YouTube视频：` : '\n\n抱歉，没有找到相关的YouTube视频，请尝试其他关键词。')
            },
            finish_reason: aiResult.choices?.[0]?.finish_reason || 'stop'
          }],
          usage: aiResult.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },
          youtubeVideos,
          type: 'youtube_recommend'
        };

        // 缓存结果
        if (cacheKey) {
          await db.setCache(cacheKey, response, 900);
        }

        return NextResponse.json(response);
      } catch (error) {
        console.error('YouTube推荐失败:', error);
        // 推荐失败时继续正常流程
      }
    }
    
    // 提取结构化推荐信息
    const recommendations = extractRecommendations(aiContent);
    
    // 构建返回格式
    const response = {
      id: aiResult.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: aiResult.created || Math.floor(Date.now() / 1000),
      model: aiResult.model || requestBody.model,
      choices: aiResult.choices || [{
        index: 0,
        message: {
          role: 'assistant',
          content: aiContent
        },
        finish_reason: aiResult.choices?.[0]?.finish_reason || 'stop'
      }],
      usage: aiResult.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      recommendations: recommendations // 添加结构化推荐数据
    };

    // 缓存结果（只对简单问题进行短时缓存，15分钟）
    if (cacheKey) {
      await db.setCache(cacheKey, response, 900); // 15分钟缓存
    }

    // 记录用户AI推荐历史（可选）
    try {
      const historyKey = `ai-recommend-history-${username}`;
      const existingHistory = await db.getCache(historyKey) || [];
      const newHistory = [
        {
          timestamp: new Date().toISOString(),
          messages: messages.slice(-1), // 只保存用户最后一条消息
          response: response.choices[0].message.content
        },
        ...existingHistory.slice(0, 9) // 保留最近10条记录
      ];
      await db.setCache(historyKey, newHistory, 7 * 24 * 3600); // 缓存一周
    } catch (error) {
      console.warn('保存AI推荐历史失败:', error);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('AI推荐API错误:', error);
    
    // 提供更详细的错误信息
    let errorMessage = '服务器内部错误';
    let errorDetails = '';
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = '无法连接到AI服务，请检查网络连接';
        errorDetails = '网络连接错误，请稍后重试';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'AI服务响应超时，请稍后重试';
        errorDetails = '请求超时，可能是网络问题或服务器负载过高';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'AI服务响应格式错误';
        errorDetails = '服务器返回了无效的数据格式';
      } else {
        errorDetails = error.message;
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails
    }, { status: 500 });
  }
}

// 获取AI推荐历史
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;
    const historyKey = `ai-recommend-history-${username}`;
    const history = await db.getCache(historyKey) || [];

    return NextResponse.json({
      history: history,
      total: history.length
    });

  } catch (error) {
    console.error('获取AI推荐历史错误:', error);
    return NextResponse.json({ 
      error: '获取历史记录失败' 
    }, { status: 500 });
  }
}

// 视频链接解析处理函数
async function handleVideoLinkParsing(videoLinks: any[]) {
  const parsedVideos = [];
  
  for (const link of videoLinks) {
    try {
      // 使用YouTube oEmbed API获取视频信息（公开，无需API Key）
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${link.videoId}&format=json`);
      
      if (response.ok) {
        const videoInfo = await response.json();
        parsedVideos.push({
          videoId: link.videoId,
          originalUrl: link.originalUrl,
          title: videoInfo?.title || '直接播放的YouTube视频',
          channelName: videoInfo?.author_name || '未知频道',
          thumbnail: `https://img.youtube.com/vi/${link.videoId}/mqdefault.jpg`,
          playable: true,
          embedUrl: `https://www.youtube.com/embed/${link.videoId}?autoplay=1&rel=0`
        });
      } else {
        // 即使oEmbed失败，也提供基本信息
        parsedVideos.push({
          videoId: link.videoId,
          originalUrl: link.originalUrl,
          title: '直接播放的YouTube视频',
          channelName: '未知频道',
          thumbnail: `https://img.youtube.com/vi/${link.videoId}/mqdefault.jpg`,
          playable: true,
          embedUrl: `https://www.youtube.com/embed/${link.videoId}?autoplay=1&rel=0`
        });
      }
    } catch (error) {
      console.error(`解析视频 ${link.videoId} 失败:`, error);
      parsedVideos.push({
        videoId: link.videoId,
        originalUrl: link.originalUrl,
        title: '解析失败的视频',
        error: '无法获取视频信息',
        playable: false
      });
    }
  }
  
  return parsedVideos;
}

// 从AI回复中提取YouTube搜索关键词（参考alpha逻辑）
function extractYouTubeSearchKeywords(content: string): string[] {
  const keywords: string[] = [];
  const videoPattern = /【([^】]+)】/g;
  let match;

  while ((match = videoPattern.exec(content)) !== null && keywords.length < 4) {
    keywords.push(match[1].trim());
  }

  return keywords;
}

// YouTube视频搜索函数（仅支持真实API）
async function searchYouTubeVideos(keywords: string[], youtubeConfig: any) {
  const videos = [];

  // 检查API Key
  if (!youtubeConfig.apiKey) {
    throw new Error('YouTube API Key未配置');
  }

  // 使用真实YouTube API
  for (const keyword of keywords) {
    if (videos.length >= 4) break;

    try {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('key', youtubeConfig.apiKey);
      searchUrl.searchParams.set('q', keyword);
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('maxResults', '1');
      searchUrl.searchParams.set('order', 'relevance');

      const response = await fetch(searchUrl.toString());
      
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const video = data.items[0];
          videos.push({
            id: video.id.videoId,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
            channelTitle: video.snippet.channelTitle,
            publishedAt: video.snippet.publishedAt
          });
        }
      }
    } catch (error) {
      console.error(`搜索关键词 "${keyword}" 失败:`, error);
    }
  }

  return videos;
}

// 从AI回复中提取推荐信息的辅助函数
function extractRecommendations(content: string) {
  const recommendations = [];
  const moviePattern = /《([^》]+)》\s*\((\d{4})\)\s*\[([^\]]+)\]\s*-\s*(.*)/;
  const lines = content.split('\n');

  for (const line of lines) {
    if (recommendations.length >= 4) {
      break;
    }
    const match = line.match(moviePattern);
    if (match) {
      const [, title, year, genre, description] = match;
      recommendations.push({
        title: title.trim(),
        year: year.trim(),
        genre: genre.trim(),
        description: description.trim() || 'AI推荐影片',
      });
    }
  }
  return recommendations;
}