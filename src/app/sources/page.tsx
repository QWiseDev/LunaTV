/* eslint-disable no-console,react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */

'use client';

import { Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { SearchResult } from '@/lib/types';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

interface VideoSource {
  key: string;
  name: string;
  api: string;
  detail?: string;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const selectedSource = searchParams.get('source') || '';
  const selectedCategory = searchParams.get('category') || '';
  const searchParam = searchParams.get('search') || '';

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
            window.history.replaceState(
              null,
              '',
              `/sources?${params.toString()}`
            );
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
        const response = await fetch(
          `/api/source/categories?source=${selectedSource}`
        );
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
        setCategoriesError(
          error instanceof Error ? error.message : '网络请求失败'
        );
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, [selectedSource]);

  // 获取视频列表
  const fetchVideos = useCallback(
    async (
      source: string,
      categoryId: string,
      page = 1,
      append = false,
      query = ''
    ) => {
      if (!source) return;

      try {
        if (!append) {
          setLoading(true);
          setVideosError(null);
          if (query) {
            setIsSearching(true);
          }
        } else {
          setIsLoadingMore(true);
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
              setCurrentPage(1);
            }
            setHasMore(false);
          } else {
            setVideos([]);
            setHasMore(false);
          }
        } else {
          if (result.code === 200) {
            if (append) {
              setVideos((prev) => [...prev, ...result.data]);
            } else {
              setVideos(result.data);
              setCurrentPage(1);
            }
            setHasMore(
              result.data.length === 20 && page < (result.pagecount || 1)
            );
          } else {
            if (!append) {
              setVideos([]);
              setHasMore(false);
              setVideosError(result.message || `错误码: ${result.code}`);
            }
          }
        }
      } catch (error) {
        console.error('获取视频列表失败:', error);
        if (!append) {
          setVideos([]);
          setHasMore(false);
          setVideosError(
            error instanceof Error ? error.message : '网络请求失败'
          );
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
        setIsSearching(false);
      }
    },
    []
  );

  // 初始化搜索查询
  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  // 当选择的源、分类或搜索参数变化时，重新加载视频
  useEffect(() => {
    if (selectedSource) {
      const categoryToUse = selectedCategory || 'all';
      fetchVideos(selectedSource, categoryToUse, 1, false, searchParam);
    } else {
      setVideos([]);
    }
  }, [selectedSource, selectedCategory, searchParam, fetchVideos]);

  // 加载更多视频
  const loadMoreVideos = useCallback(() => {
    if (selectedSource && hasMore && !isLoadingMore && !searchParam) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      const categoryToUse = selectedCategory || 'all';
      fetchVideos(selectedSource, categoryToUse, nextPage, true);
    }
  }, [
    selectedSource,
    selectedCategory,
    hasMore,
    isLoadingMore,
    currentPage,
    searchParam,
    fetchVideos,
  ]);

  // 设置滚动监听
  useEffect(() => {
    if (!hasMore || isLoadingMore || loading) {
      return;
    }

    if (!loadingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreVideos();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loading, loadMoreVideos]);

  // 处理源选择
  const handleSourceChange = (sourceKey: string) => {
    setVideos([]);
    setCategories([]);
    setCurrentPage(1);
    setHasMore(true);
    setSearchQuery('');
    setCategoriesLoading(false);

    const params = new URLSearchParams();
    params.set('source', sourceKey);
    window.history.pushState(null, '', `/sources?${params.toString()}`);
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
    window.history.pushState(null, '', `/sources?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // 清空搜索
  const clearSearch = () => {
    setSearchQuery('');
    const params = new URLSearchParams();
    if (selectedSource) params.set('source', selectedSource);
    if (selectedCategory) params.set('category', selectedCategory);
    window.history.pushState(null, '', `/sources?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // 处理分类选择
  const handleCategoryChange = (categoryId: string) => {
    const params = new URLSearchParams();
    if (selectedSource) params.set('source', selectedSource);
    params.set('category', categoryId);
    if (searchParam) params.set('search', searchParam);
    window.history.pushState(null, '', `/sources?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // 获取当前选中的源和分类名称
  const selectedSourceName =
    sources.find((s) => s.key === selectedSource)?.name || '';

  // 生成骨架屏数据
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
      <div className='px-4 sm:px-10 py-3 sm:py-6'>
        {/* 搜索框 */}
        {selectedSource && (
          <div className='mb-4 flex justify-center'>
            <div className='relative max-w-md w-full group'>
              <div className='relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border border-gray-200/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-blue-300/60 group-focus-within:border-blue-400/60'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Search className='h-4 w-4 text-gray-400 dark:text-gray-300 group-focus-within:text-blue-400 transition-all duration-200' />
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
                  className='block w-full pl-10 pr-20 py-2.5 text-sm bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400'
                />
                <div className='absolute inset-y-0 right-0 flex items-center'>
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className='px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                    >
                      清空
                    </button>
                  )}
                  <button
                    onClick={() => handleSearch(searchQuery)}
                    className='mr-1 px-2.5 py-1 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
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
        {!sourcesLoading && sources.length > 0 && (
          <div className='mb-4'>
            <div className='bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 border border-gray-200/50 dark:border-gray-600/50 backdrop-blur-lg shadow-sm'>
              <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                <span className='text-xs font-medium text-gray-600 dark:text-gray-300 min-w-[50px] flex-shrink-0 flex items-center gap-1'>
                  🎬 <span className='hidden sm:inline'>视频源</span>
                </span>
                <div className='w-full'>
                  <div className='flex flex-wrap gap-1.5 bg-gray-100/60 dark:bg-gray-700/60 rounded-lg p-1.5'>
                    {sources.map((source) => {
                      const isActive = selectedSource === source.key;
                      return (
                        <button
                          key={source.key}
                          onClick={() => handleSourceChange(source.key)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                            isActive
                              ? 'bg-white dark:bg-gray-500 text-blue-700 dark:text-blue-300 shadow-sm scale-[1.02]'
                              : 'text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-white/60 dark:hover:bg-gray-600/60'
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
            <div className='bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 border border-gray-200/50 dark:border-gray-600/50 backdrop-blur-lg shadow-sm'>
              <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                <span className='text-xs font-medium text-gray-600 dark:text-gray-300 min-w-[50px] flex-shrink-0 flex items-center gap-1'>
                  🏷️ <span className='hidden sm:inline'>分类</span>
                </span>
                <div className='w-full'>
                  <div className='flex flex-wrap gap-1.5 bg-gray-100/60 dark:bg-gray-700/60 rounded-lg p-1.5'>
                    <button
                      onClick={() => handleCategoryChange('all')}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                        !selectedCategory || selectedCategory === 'all'
                          ? 'bg-white dark:bg-gray-500 text-purple-700 dark:text-purple-300 shadow-sm scale-[1.02]'
                          : 'text-gray-600 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-white/60 dark:hover:bg-gray-600/60'
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
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                            isActive
                              ? 'bg-white dark:bg-gray-500 text-purple-700 dark:text-purple-300 shadow-sm scale-[1.02]'
                              : 'text-gray-600 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-white/60 dark:hover:bg-gray-600/60'
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
          <div className='mb-4'>
            <div className='bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-3'>
              <h3 className='text-xs font-medium text-red-800 dark:text-red-200 mb-1'>
                {selectedSourceName} - 分类加载失败
              </h3>
              <p className='text-xs text-red-700 dark:text-red-300'>
                {categoriesError}
              </p>
            </div>
          </div>
        )}

        {/* 内容展示区域 */}
        <div className='max-w-[95%] mx-auto mt-6'>
          <div className='grid grid-cols-3 gap-x-3 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-6 sm:gap-y-16'>
            {loading
              ? skeletonData.map((index) => (
                  <div key={index} className='animate-pulse'>
                    <DoubanCardSkeleton />
                  </div>
                ))
              : videos.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className='w-full group transform transition-all duration-300 hover:scale-105'
                  >
                    <VideoCard
                      from='search'
                      title={item.title}
                      poster={item.poster}
                      year={item.year}
                      source={item.source}
                      source_name={item.source_name}
                      id={item.id}
                      episodes={item.episodes.length}
                      query={selectedSourceName}
                    />
                  </div>
                ))}
          </div>

          {/* 加载更多指示器 */}
          {hasMore && !loading && videos.length > 0 && !searchParam && (
            <div
              ref={(el) => {
                if (el && el.offsetParent !== null) {
                  (loadingRef as any).current = el;
                }
              }}
              className='flex justify-center mt-12 py-8'
            >
              {isLoadingMore && (
                <div className='flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-gray-200/50 dark:border-gray-600/50 shadow-lg'>
                  <div className='animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent'></div>
                  <span className='text-gray-700 dark:text-gray-300 font-medium'>
                    加载中...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 没有更多数据提示 */}
          {!hasMore && videos.length > 0 && (
            <div className='text-center text-gray-500 dark:text-gray-400 py-12 mt-8'>
              <div className='bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl px-6 py-4 border border-gray-200/30 dark:border-gray-600/30 inline-block'>
                <span className='flex items-center gap-2'>
                  <span>✨</span>
                  已加载全部内容
                  <span>✨</span>
                </span>
              </div>
            </div>
          )}

          {/* 视频加载错误 */}
          {!loading && videosError && (
            <div className='bg-red-50 dark:bg-red-900/20 rounded-3xl border-2 border-red-200 dark:border-red-800 p-8 mb-12'>
              <h3 className='text-lg font-bold text-red-800 dark:text-red-200 mb-2'>
                视频加载失败
              </h3>
              <p className='text-sm text-red-700 dark:text-red-300 mb-3'>
                {videosError}
              </p>
              <p className='text-sm text-red-600 dark:text-red-400'>
                💡 请尝试切换其他视频源或分类
              </p>
            </div>
          )}

          {/* 空状态 */}
          {!loading && videos.length === 0 && selectedSource && !videosError && (
            <div className='text-center py-24'>
              <div className='max-w-md mx-auto'>
                <div className='w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-6'>
                  <span className='text-4xl'>📺</span>
                </div>
                <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200 mb-3'>
                  暂无相关内容
                </h3>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  🔍 当前分类下没有找到视频，请尝试其他分类或视频源
                </p>
              </div>
            </div>
          )}

          {/* 未选择状态 */}
          {!loading && !selectedSource && (
            <div className='text-center py-32'>
              <div className='max-w-lg mx-auto'>
                <div className='w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-8'>
                  <span className='text-5xl'>🚀</span>
                </div>
                <h3 className='text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4'>
                  开始探索视频内容
                </h3>
                <p className='text-gray-600 dark:text-gray-400'>
                  ✨ 请在上方选择一个视频源来浏览精彩内容 ✨
                </p>
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
    <Suspense fallback={<div>Loading...</div>}>
      <SourcesPageClient />
    </Suspense>
  );
}