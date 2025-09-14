'use client';

import { 
  ArrowPathIcon,
  CheckCircleIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  MagnifyingGlassIcon, 
  PlayIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SearchResult } from '@/lib/types';

import VideoCard from '@/components/VideoCard';

// API源信息接口
interface ApiSite {
  key: string;
  name: string;
  api: string;
  disabled?: boolean;
}

// 源测试结果接口
interface SourceTestResult {
  source: string;
  sourceName: string;
  status: 'pending' | 'testing' | 'success' | 'error' | 'timeout';
  results: SearchResult[];
  responseTime?: number;
  error?: string;
  disabled?: boolean;
}

// 获取所有源信息（包括禁用的）
async function getAllApiSites(): Promise<ApiSite[]> {
  try {
    const response = await fetch('/api/sources');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.sources || [];
  } catch (error) {
    console.error('获取源配置失败:', error);
    // 如果无法获取配置，尝试通过搜索API获取可用源
    try {
      const response = await fetch('/api/search?q=测试');
      const data = await response.json();
      
      const sources: ApiSite[] = [];
      if (data.results) {
        data.results.forEach((result: any) => {
          if (result.source && !sources.find(s => s.key === result.source)) {
            sources.push({
              key: result.source,
              name: result.source_name || result.source,
              api: '',
              disabled: false
            });
          }
        });
      }
      return sources;
    } catch (fallbackError) {
      console.error('获取源列表失败:', fallbackError);
      return [];
    }
  }
}

// 测试单个源
async function testSource(sourceKey: string, query: string): Promise<SourceTestResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`/api/source-test?q=${encodeURIComponent(query)}&source=${sourceKey}`);
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        source: sourceKey,
        sourceName: sourceKey,
        status: response.status === 408 ? 'timeout' : 'error',
        results: [],
        responseTime,
        error: errorData.sourceError || errorData.error || `HTTP ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // 转换结果格式为 SearchResult
    const results: SearchResult[] = Array.isArray(data.results) 
      ? data.results.map((item: any) => ({
          id: item.vod_id || item.id || '',
          title: item.vod_name || item.title || '未知标题',
          poster: item.vod_pic || item.poster || '',
          year: item.vod_year || item.year || '',
          episodes: item.vod_play_url ? item.vod_play_url.split('$$$') : [],
          episodes_titles: [],
          source: sourceKey,
          source_name: data.sourceName || sourceKey,
          class: item.type_name || item.type || '',
          desc: item.vod_content || item.desc || '',
          type_name: item.type_name || item.type || '',
          douban_id: item.vod_douban_id || item.douban_id
        }))
      : [];
    
    return {
      source: sourceKey,
      sourceName: data.sourceName || sourceKey,
      status: 'success',
      results,
      responseTime,
      disabled: data.disabled
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      source: sourceKey,
      sourceName: sourceKey,
      status: 'error',
      results: [],
      responseTime,
      error: error.message
    };
  }
}

export default function SourceTestModule() {
  const router = useRouter();
  const [sources, setSources] = useState<ApiSite[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('斗罗大陆');
  const [testResults, setTestResults] = useState<Map<string, SourceTestResult>>(new Map());
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [selectedResults, setSelectedResults] = useState<SearchResult[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);

  // 加载所有源
  useEffect(() => {
    getAllApiSites().then(setSources);
  }, []);

  // 测试单个源
  const handleTestSingle = async (sourceKey: string) => {
    if (!searchKeyword.trim()) {
      alert('请输入搜索关键词');
      return;
    }

    const source = sources.find(s => s.key === sourceKey);
    if (!source) return;

    setTestResults(prev => new Map(prev.set(sourceKey, {
      source: sourceKey,
      sourceName: source.name,
      status: 'testing',
      results: [],
      disabled: source.disabled
    })));

    const result = await testSource(sourceKey, searchKeyword);
    result.sourceName = source.name;
    result.disabled = source.disabled;
    
    setTestResults(prev => new Map(prev.set(sourceKey, result)));
  };

  // 测试所有源
  const handleTestAll = async () => {
    if (!searchKeyword.trim()) {
      alert('请输入搜索关键词');
      return;
    }

    setIsTestingAll(true);
    setTestResults(new Map());

    // 初始化所有源的状态
    const initialResults = new Map<string, SourceTestResult>();
    sources.forEach(source => {
      initialResults.set(source.key, {
        source: source.key,
        sourceName: source.name,
        status: 'pending',
        results: [],
        disabled: source.disabled
      });
    });
    setTestResults(initialResults);

    // 测试所有源（包括禁用的）
    const testPromises = sources.map(async (source) => {
      // 更新状态为测试中
      setTestResults(prev => new Map(prev.set(source.key, {
        ...prev.get(source.key)!,
        status: 'testing'
      })));

      const result = await testSource(source.key, searchKeyword);
      result.sourceName = source.name;
      result.disabled = source.disabled;
      
      // 更新单个结果
      setTestResults(prev => new Map(prev.set(source.key, result)));
      
      return result;
    });

    await Promise.allSettled(testPromises);
    setIsTestingAll(false);
  };

  // 查看详细结果
  const handleViewResults = (results: SearchResult[]) => {
    setSelectedResults(results);
    setShowResultsModal(true);
  };

  // 播放视频
  const handlePlay = (result: SearchResult) => {
    const params = new URLSearchParams({
      id: result.id || '',
      source: result.source || '',
      title: result.title || '',
    });
    
    router.push(`/play?${params.toString()}`);
  };

  // 获取统计信息
  const getStats = () => {
    const results = Array.from(testResults.values());
    const enabledResults = results.filter(r => !r.disabled);
    const disabledResults = results.filter(r => r.disabled);
    
    const enabledTotal = enabledResults.length;
    const enabledSuccess = enabledResults.filter(r => r.status === 'success').length;
    const enabledError = enabledResults.filter(r => r.status === 'error').length;
    const enabledTimeout = enabledResults.filter(r => r.status === 'timeout').length;
    const enabledTesting = enabledResults.filter(r => r.status === 'testing').length;
    
    const disabledTotal = disabledResults.length;
    const disabledSuccess = disabledResults.filter(r => r.status === 'success').length;
    const disabledError = disabledResults.filter(r => r.status === 'error').length;
    const disabledTimeout = disabledResults.filter(r => r.status === 'timeout').length;
    const disabledTesting = disabledResults.filter(r => r.status === 'testing').length;
    
    const total = results.length;
    const success = enabledSuccess + disabledSuccess;
    const error = enabledError + disabledError;
    const timeout = enabledTimeout + disabledTimeout;
    const testing = enabledTesting + disabledTesting;
    
    return { 
      total, success, error, timeout, testing, 
      enabledTotal, enabledSuccess, enabledError, enabledTimeout, enabledTesting,
      disabledTotal, disabledSuccess, disabledError, disabledTimeout, disabledTesting
    };
  };

  const stats = getStats();

  // 状态图标
  const getStatusIcon = (status: string, disabled?: boolean) => {
    if (disabled) {
      return <div className="w-4 h-4 rounded-full bg-gray-400" title="已禁用" />;
    }
    
    switch (status) {
      case 'testing':
        return <ArrowPathIcon className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircleIcon className="w-4 h-4 text-red-500" />;
      case 'timeout':
        return <ClockIcon className="w-4 h-4 text-yellow-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* 标题 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          源检测工具
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          测试各个源的搜索功能和响应速度，查看搜索结果质量
        </p>
      </div>

      {/* 搜索控制 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              搜索关键词
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="输入要搜索的内容..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleTestAll}
              disabled={isTestingAll || !searchKeyword.trim() || sources.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                       disabled:bg-gray-400 disabled:cursor-not-allowed
                       flex items-center gap-2 whitespace-nowrap"
            >
              {isTestingAll ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <PlayIcon className="w-4 h-4" />
              )}
              测试所有源
            </button>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      {testResults.size > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">测试统计</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">总源数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.success}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">成功</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.error}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">失败</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.timeout}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">超时</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.testing}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">测试中</div>
            </div>
          </div>
          
          {/* 详细统计 */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">启用源 ({stats.enabledTotal})</h4>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">成功: {stats.enabledSuccess}</span>
                  <span className="text-red-600">失败: {stats.enabledError}</span>
                  <span className="text-yellow-600">超时: {stats.enabledTimeout}</span>
                  <span className="text-blue-600">测试中: {stats.enabledTesting}</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">禁用源 ({stats.disabledTotal})</h4>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">成功: {stats.disabledSuccess}</span>
                  <span className="text-red-600">失败: {stats.disabledError}</span>
                  <span className="text-yellow-600">超时: {stats.disabledTimeout}</span>
                  <span className="text-blue-600">测试中: {stats.disabledTesting}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 源列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            源列表 ({sources.length} 个源)
          </h3>
        </div>
        
        <div className="space-y-3">
          {sources.map((source) => {
            const result = testResults.get(source.key);
            return (
              <div
                key={source.key}
                className={`border rounded-lg p-4 ${
                  source.disabled 
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(result?.status || 'pending', source.disabled)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          source.disabled 
                            ? 'text-gray-500 dark:text-gray-400' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {source.name}
                        </span>
                        {source.disabled && (
                          <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            已禁用
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {source.key} • {source.api}
                      </div>
                    </div>
                    
                    {result && (
                      <div className="text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {result.responseTime && `${result.responseTime}ms`}
                        </div>
                        {result.status === 'success' && (
                          <div className="text-sm text-green-600">
                            {result.results.length} 个结果
                          </div>
                        )}
                        {result.status === 'error' && (
                          <div className="text-sm text-red-600">请求失败</div>
                        )}
                        {result.status === 'timeout' && (
                          <div className="text-sm text-yellow-600">请求超时</div>
                        )}
                        {result.status === 'testing' && (
                          <div className="text-sm text-blue-600">测试中...</div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {result?.results && result.results.length > 0 && (
                      <button
                        onClick={() => handleViewResults(result.results)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        查看结果
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleTestSingle(source.key)}
                      disabled={result?.status === 'testing'}
                      className={`px-3 py-1 text-sm rounded disabled:cursor-not-allowed ${
                        source.disabled
                          ? 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-400'
                          : 'bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400'
                      }`}
                    >
                      {result?.status === 'testing' ? '测试中' : source.disabled ? '测试禁用源' : '单独测试'}
                    </button>
                  </div>
                </div>
                
                {result?.error && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    错误: {result.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 结果详情弹窗 */}
      {showResultsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                搜索结果 ({selectedResults.length} 个)
              </h3>
              <button
                onClick={() => setShowResultsModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {selectedResults.map((result, index) => (
                  <VideoCard
                    key={`${result.source}-${result.id}-${index}`}
                    id={result.id}
                    title={result.title}
                    poster={result.poster}
                    year={result.year}
                    episodes={result.episodes.length}
                    source={result.source}
                    source_name={result.source_name}
                    from="search"
                    type={result.type_name}
                    rate={result.desc}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {sources.length === 0 && (
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            正在加载源列表...
          </p>
        </div>
      )}
    </div>
  );
}