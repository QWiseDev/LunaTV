/* eslint-disable no-console,react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */

'use client';

import { Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { SearchResult } from '@/lib/types';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

interface VideoSource {
  key: string;
  name: string;
  api: string;
}

interface VideoCategory {
  type_id: string;
  type_name: string;
  type_pid: number;
}

function SourcesPageClient() {
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [videos, setVideos] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [urlParams, setUrlParams] = useState(new URLSearchParams());

  // 监听 URL 变化
  useEffect(() => {
    const updateParams = () => {
      setUrlParams(new URLSearchParams(window.location.search));
    };
    
    updateParams();
    window.addEventListener('popstate', updateParams);
    
    return () => window.removeEventListener('popstate', updateParams);
  }, []);

  const selectedSource = urlParams.get('source') || searchParams.get('source') || '';
  const selectedCategory = urlParams.get('category') || searchParams.get('category') || '';
  const searchParam = urlParams.get('search') || searchParams.get('search') || '';

  // 获取视频源列表
  useEffect(() => {
    const fetchSources = async () => {
      try {
        setSourcesLoading(true);
        const response = await fetch('/api/source/list');
        const result = await response.json();

        if (result.code === 200) {
          setSources(result.data);

          if (!selectedSource && result.data.length > 0) {
            const firstSource = result.data[0];
            const params = new URLSearchParams();
            params.set('source', firstSource.key);
            window.history.replaceState(null, '', `/sources?${params.toString()}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }
      } catch (error) {
        console.error('获取视频源失败:', error);
      } finally {
        setSourcesLoading(false);
      }
    };

    fetchSources();
  }, [selectedSource]);

  // 获取分类列表
  useEffect(() => {
    if (!selectedSource) {
      setCategories([]);
      return;
    }

    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        setCategoriesError(null);
        const response = await fetch(`/api/source/categories?source=${selectedSource}`);
        const result = await response.json();

        if (result.code === 200) {
          setCategories(result.data);
        } else {
          setCategories([]);
          setCategoriesError(result.message || `错误码: ${result.code}`);
        }
      } catch (error) {
        console.error('获取分类失败:', error);
        setCategories([]);
        setCategoriesError(error instanceof Error ? error.message : '网络请求失败');
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, [selectedSource]);

  // 获取视频列表
  const fetchVideos = useCallback(
    async (source: string, categoryId: string, page = 1, append = false, query = '') => {
      if (!source) return;

      try {
        if (!append) {
          setLoading(true);
          setVideosError(null);
          if (query) {
            setIsSearching(true);
          }
        }

        let url;
        if (query) {
          url = `/api/search?q=${encodeURIComponent(query)}&sources=${source}`;
        } else {
          url = `/api/source/videos?source=${source}&page=${page}&limit=20`;
          if (categoryId && categoryId !== 'all') {
            url += `&type_id=${categoryId}`;
          }
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (query) {
          if (result.results && Array.isArray(result.results)) {
            let searchResults = result.results;
            const hasMultipleSources = result.results.some(
              (item: SearchResult) => item.source !== source
            );
            if (hasMultipleSources) {
              searchResults = result.results.filter(
                (item: SearchResult) => item.source === source
              );
            }

            if (append) {
              setVideos((prev) => [...prev, ...searchResults]);
            } else {
              setVideos(searchResults);
            }
            
            // 搜索结果通常不支持分页，设置 hasMore 为 false
            setHasMore(false);
          } else {
            setVideos([]);
            setHasMore(false);
          }
        } else {
          if (result.code === 200) {
            const newVideos = result.data || [];
            if (append) {
              setVideos((prev) => [...prev, ...newVideos]);
            } else {
              setVideos(newVideos);
            }
            
            // 检查是否还有更多数据
            // 如果返回的数据少于请求的数量，说明没有更多数据了
            setHasMore(newVideos.length === 20);
          } else {
            if (!append) {
              setVideos([]);
              setVideosError(result.message || `错误码: ${result.code}`);
              setHasMore(false);
            }
          }
        }
      } catch (error) {
        console.error('获取视频列表失败:', error);
        if (!append) {
          setVideos([]);
          setVideosError(error instanceof Error ? error.message : '网络请求失败');
        }
      } finally {
        setLoading(false);
        setIsSearching(false);
        if (append) {
          setIsLoadingMore(false);
        }
      }
    },
    []
  );

  // 加载更多数据
  const loadMoreVideos = useCallback(async () => {
    if (!selectedSource || isLoadingMore || !hasMore || searchParam) return;
    
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    await fetchVideos(selectedSource, selectedCategory || 'all', nextPage, true);
    setCurrentPage(nextPage);
  }, [selectedSource, selectedCategory, currentPage, isLoadingMore, hasMore, searchParam, fetchVideos]);

  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  useEffect(() => {
    if (selectedSource) {
      // 重置分页状态
      setCurrentPage(1);
      setHasMore(true);
      const categoryToUse = selectedCategory || 'all';
      fetchVideos(selectedSource, categoryToUse, 1, false, searchParam);
    } else {
      setVideos([]);
      setCurrentPage(1);
      setHasMore(true);
    }
  }, [selectedSource, selectedCategory, searchParam, fetchVideos]);

  // 滚动监听，实现无限加载
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 1000) {
        loadMoreVideos();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMoreVideos]);

  // 处理源选择
  const handleSourceChange = (sourceKey: string) => {
    setVideos([]);
    setCategories([]);
    setSearchQuery('');
    setCategoriesLoading(false);
    setCurrentPage(1);
    setHasMore(true);

    const params = new URLSearchParams();
    params.set('source', sourceKey);
    const newUrl = `/sources?${params.toString()}`;
    window.history.pushState(null, '', newUrl);
    
    // 手动更新 URL 参数状态
    setUrlParams(new URLSearchParams(params));
    
    // 触发 popstate 事件
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // 处理搜索
  const handleSearch = (query: string) => {
    const params = new URLSearchParams();
    if (selectedSource) params.set('source', selectedSource);
    if (selectedCategory) params.set('category', selectedCategory);
    if (query.trim()) {
      params.set('search', query.trim());
    }
    const newUrl = `/sources?${params.toString()}`;
    window.history.pushState(null, '', newUrl);
    
    // 手动更新 URL 参数状态
    setUrlParams(new URLSearchParams(params));
    
    // 触发 popstate 事件
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // 处理分类选择
  const handleCategoryChange = (categoryId: string) => {
    const params = new URLSearchParams();
    if (selectedSource) params.set('source', selectedSource);
    // 只有非 'all' 分类才设置 category 参数
    if (categoryId !== 'all') {
      params.set('category', categoryId);
    }
    if (searchParam) params.set('search', searchParam);
    const newUrl = `/sources?${params.toString()}`;
    window.history.pushState(null, '', newUrl);
    
    // 手动更新 URL 参数状态
    setUrlParams(new URLSearchParams(params));
    
    // 触发 popstate 事件
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const selectedSourceName = sources.find((s) => s.key === selectedSource)?.name || '';
  const skeletonData = Array.from({ length: 20 }, (_, index) => index);

  const getActivePath = () => {
    const params = new URLSearchParams();
    if (selectedSource) params.set('source', selectedSource);
    if (selectedCategory) params.set('category', selectedCategory);
    if (searchParam) params.set('search', searchParam);
    const queryString = params.toString();
    return `/sources${queryString ? `?${queryString}` : ''}`;
  };

  return (
    <PageLayout activePath={getActivePath()}>
      <div className='px-4 sm:px-10 py-3 sm:py-6 overflow-visible'>
        {/* 搜索框 */}
        {selectedSource && (
          <div className='mb-6 flex justify-center'>
            <div className='relative max-w-md w-full group'>
              <div className='relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-gray-600/60 shadow-lg hover:shadow-xl transition-all duration-300'>
                <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                  <Search className='h-5 w-5 text-gray-400 dark:text-gray-300' />
                </div>
                <input
                  type='text'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(searchQuery);
                    }
                  }}
                  placeholder={`在 ${selectedSourceName} 中搜索...`}
                  className='block w-full pl-12 pr-24 py-3 text-sm bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400'
                />
                <div className='absolute inset-y-0 right-0 flex items-center'>
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        const params = new URLSearchParams();
                        if (selectedSource) params.set('source', selectedSource);
                        if (selectedCategory) params.set('category', selectedCategory);
                        window.history.pushState(null, '', `/sources?${params.toString()}`);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      className='px-2 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                    >
                      清空
                    </button>
                  )}
                  <button
                    onClick={() => handleSearch(searchQuery)}
                    className='mr-1 px-2.5 py-1.5 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 disabled:opacity-50'
                    disabled={isSearching}
                  >
                    {isSearching ? '搜索中...' : '搜索'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 视频源选择 */}
        {!sourcesLoading && (
          <div className='mb-4'>
            <div className='bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 border border-gray-200/50 dark:border-gray-600/50 backdrop-blur-lg shadow-lg transition-all duration-300'>
              <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                <span className='text-sm font-semibold text-gray-700 dark:text-gray-200 min-w-[60px] flex-shrink-0 flex items-center gap-2'>
                  <span className='hidden sm:inline'>🎬</span>
                  <span className='sm:hidden'>🎬</span>
                  <span className='hidden sm:inline'>视频源</span>
                </span>
                <div className='w-full'>
                  <div className='flex flex-wrap gap-1.5 bg-gradient-to-r from-gray-100/80 via-blue-50/80 to-cyan-50/80 dark:from-gray-700/80 dark:via-gray-600/80 dark:to-gray-700/80 rounded-xl p-1.5'>
                    {sources.map((source) => {
                      const isActive = selectedSource === source.key;
                      return (
                        <button
                          key={source.key}
                          onClick={() => handleSourceChange(source.key)}
                          className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${isActive
                              ? 'text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-500 shadow-lg scale-105'
                              : 'text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 hover:scale-105'
                            }`}
                        >
                          {source.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 分类选择 */}
        {selectedSource && !categoriesLoading && categories.length > 0 && (
          <div className='mb-4'>
            <div className='bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 border border-gray-200/50 dark:border-gray-600/50 backdrop-blur-lg shadow-lg transition-all duration-300'>
              <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                <span className='text-sm font-semibold text-gray-700 dark:text-gray-200 min-w-[60px] flex-shrink-0 flex items-center gap-2'>
                  <span className='hidden sm:inline'>🏷️</span>
                  <span className='sm:hidden'>🏷️</span>
                  <span className='hidden sm:inline'>分类</span>
                </span>
                <div className='w-full'>
                  <div className='flex flex-wrap gap-1.5 bg-gradient-to-r from-gray-100/80 via-purple-50/80 to-pink-50/80 dark:from-gray-700/80 dark:via-gray-600/80 dark:to-gray-700/80 rounded-xl p-1.5'>
                    <button
                      onClick={() => handleCategoryChange('all')}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${(!selectedCategory || selectedCategory === '' || selectedCategory === 'all')
                          ? 'text-purple-700 dark:text-purple-300 bg-white dark:bg-gray-500 shadow-lg scale-105'
                          : 'text-gray-700 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 hover:scale-105'
                        }`}
                    >
                      全部
                    </button>
                    {categories.map((category) => {
                      const isActive = selectedCategory === category.type_id;
                      return (
                        <button
                          key={category.type_id}
                          onClick={() => handleCategoryChange(category.type_id)}
                          className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${isActive
                              ? 'text-purple-700 dark:text-purple-300 bg-white dark:bg-gray-500 shadow-lg scale-105'
                              : 'text-gray-700 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 hover:scale-105'
                            }`}
                        >
                          {category.type_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {selectedSource && !categoriesLoading && categoriesError && (
          <div className='mb-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 p-4'>
            <div className='flex items-start gap-3'>
              <div className='w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center'>
                <span className='text-white text-sm'>⚠️</span>
              </div>
              <div className='flex-1'>
                <h3 className='text-sm font-bold text-red-800 dark:text-red-200 mb-1'>
                  {selectedSourceName} - 分类加载失败
                </h3>
                <p className='text-xs text-red-700 dark:text-red-300'>{categoriesError}</p>
              </div>
            </div>
          </div>
        )}

        {/* 内容展示区域 */}
        <div className='max-w-[95%] mx-auto mt-6 overflow-visible'>
          <div className='grid grid-cols-3 gap-x-3 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-24'>
            {loading
              ? skeletonData.map((index) => (
                <div key={index} className='animate-pulse'>
                  <DoubanCardSkeleton />
                </div>
              ))
              : videos.map((item, index) => (
                <div key={`${item.id}-${index}`} className='w-full group transform transition-all duration-300 hover:scale-105'>
                  <VideoCard
                    from='search'
                    title={item.title}
                    poster={item.poster}
                    year={item.year}
                    source={item.source}
                    source_name={item.source_name}
                    id={item.id}
                    episodes={item.episodes.length}
                    query={selectedCategory || 'all'}
                  />
                </div>
              ))}
          </div>

          {/* 加载更多指示器 */}
          {!loading && videos.length > 0 && hasMore && !searchParam && (
            <div className="text-center py-8">
              {isLoadingMore ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">加载更多内容...</span>
                </div>
              ) : (
                <button
                  onClick={loadMoreVideos}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  加载更多
                </button>
              )}
            </div>
          )}

          {/* 没有更多数据提示 */}
          {!loading && videos.length > 0 && !hasMore && !searchParam && (
            <div className="text-center py-8">
              <span className="text-sm text-gray-500 dark:text-gray-400">已加载全部内容</span>
            </div>
          )}

          {/* 空状态 */}
          {!loading && videos.length === 0 && selectedSource && !videosError && (
            <div className='text-center py-24'>
              <div className='max-w-md mx-auto'>
                <div className='w-20 h-20 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg'>
                  <span className='text-4xl'>📺</span>
                </div>
                <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200 mb-3'>暂无相关内容</h3>
                <p className='text-sm text-gray-600 dark:text-gray-400'>当前分类下没有找到视频，请尝试其他分类或视频源</p>
              </div>
            </div>
          )}

          {/* 未选择状态 */}
          {!loading && !selectedSource && (
            <div className='text-center py-32'>
              <div className='max-w-lg mx-auto'>
                <div className='w-24 h-24 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl'>
                  <span className='text-5xl'>🚀</span>
                </div>
                <h3 className='text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4'>开始探索视频内容</h3>
                <p className='text-gray-600 dark:text-gray-400'>请在上方选择一个视频源来浏览精彩内容</p>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {!loading && videosError && (
            <div className='bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-200 dark:border-red-800 p-8 mb-12'>
              <div className='flex items-start gap-4'>
                <div className='w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg'>
                  <span className='text-white text-lg'>🚨</span>
                </div>
                <div className='flex-1'>
                  <h3 className='text-lg font-bold text-red-800 dark:text-red-200 mb-2'>视频加载失败</h3>
                  <p className='text-sm text-red-700 dark:text-red-300 mb-3'>{videosError}</p>
                  <p className='text-sm text-red-600 dark:text-red-400'>请尝试切换其他视频源或分类</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function SourcesPage() {
  return (
    <Suspense>
      <SourcesPageClient />
    </Suspense>
  );
}