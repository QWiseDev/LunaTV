'use client';

import {
  ChevronRight,
  Layers,
  ListFilter,
  PlayCircle,
  RefreshCw,
  Server,
  Shield,
  Tv,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import PageLayout from '@/components/PageLayout';

type SecurityConfig = {
  enableAuth: boolean;
  token: string;
  enableIpWhitelist: boolean;
  allowedIPs: string[];
  enableRateLimit: boolean;
  rateLimit: number;
} | null;

type TVBoxSite = {
  key: string;
  name: string;
  api: string;
  type: number;
  categories?: string[];
};

type TVBoxResponse = {
  sites: TVBoxSite[];
};

type SearchResult = {
  id: string;
  title: string;
  poster: string;
  year: string;
  source: string;
  source_name: string;
  episodes: string[];
  episodes_titles: string[];
};

export default function TVBoxExplorePage() {
  const router = useRouter();

  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [sites, setSites] = useState<TVBoxSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);

  const [activeSiteKey, setActiveSiteKey] = useState<string>('');
  const activeSite = useMemo(
    () => sites.find((s) => s.key === activeSiteKey),
    [sites, activeSiteKey]
  );

  const [activeCategory, setActiveCategory] = useState<string>('');

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  // 读取安全配置（以便在需要时携带 token 请求 /api/tvbox）
  const fetchSecurityConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/admin/config');
      if (!res.ok) throw new Error('获取安全配置失败');
      const data = await res.json();
      setSecurityConfig(data.Config.TVBoxSecurityConfig || null);
    } catch (e: unknown) {
      // 静默失败，继续尝试访问 /api/tvbox（若开启了鉴权会返回 401）
      setSecurityConfig(null);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // 拉取 /api/tvbox 配置并提取 sites
  const fetchTVBoxSites = useCallback(async (sec: SecurityConfig) => {
    setLoadingSites(true);
    setSitesError(null);
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      let url = `${origin}/api/tvbox?format=json`;
      if (sec?.enableAuth && sec.token) {
        url += `&token=${sec.token}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `获取 TVBox 配置失败: ${res.status}`);
      }
      const data: TVBoxResponse = await res.json();
      const list = Array.isArray(data.sites) ? data.sites : [];
      setSites(list);
      if (list.length > 0) {
        setActiveSiteKey(list[0].key);
        const cat =
          list[0].categories && list[0].categories.length > 0
            ? list[0].categories[0]
            : '';
        setActiveCategory(cat);
      }
    } catch (e: unknown) {
      setSitesError(e instanceof Error ? e.message : '获取 TVBox 配置失败');
      setSites([]);
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityConfig();
  }, [fetchSecurityConfig]);

  useEffect(() => {
    if (!loadingConfig) {
      fetchTVBoxSites(securityConfig);
    }
  }, [loadingConfig, securityConfig, fetchTVBoxSites]);

  // 根据站点与分类拉取结果
  const fetchResults = useCallback(
    async (siteKey: string, category: string) => {
      if (!siteKey || !category) {
        setResults([]);
        return;
      }
      setLoadingResults(true);
      setResultsError(null);
      try {
        // 使用源测试接口直接查询该源，避免严格匹配导致无结果
        const res = await fetch(
          `/api/source-test?source=${encodeURIComponent(
            siteKey
          )}&q=${encodeURIComponent(category)}`
        );
        if (!res.ok) {
          const data = (await res
            .json()
            .catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `搜索失败: ${res.status}`);
        }
        type SourceTestItem = {
          vod_id?: string | number;
          id?: string | number;
          vod_name?: string;
          title?: string;
          vod_pic?: string;
          poster?: string;
          vod_year?: string;
          year?: string;
        };
        const data = (await res.json()) as {
          results?: SourceTestItem[];
          sourceName?: string;
        };
        const raw: SourceTestItem[] = data.results || [];
        const mapped: SearchResult[] = raw
          .map((r) => ({
            id: String(r.vod_id ?? r.id ?? ''),
            title: String(r.vod_name ?? r.title ?? ''),
            poster: String(r.vod_pic ?? r.poster ?? ''),
            year: String(r.vod_year ?? r.year ?? ''),
            source: siteKey,
            source_name: data.sourceName || siteKey,
            episodes: [],
            episodes_titles: [],
          }))
          .filter((r) => r.id && r.title);
        setResults(mapped);
      } catch (e: unknown) {
        setResultsError(e instanceof Error ? e.message : '搜索失败');
        setResults([]);
      } finally {
        setLoadingResults(false);
      }
    },
    []
  );

  // 当站点/分类变化时触发搜索
  useEffect(() => {
    if (activeSiteKey && activeCategory) {
      fetchResults(activeSiteKey, activeCategory);
    }
  }, [activeSiteKey, activeCategory, fetchResults]);

  const handlePlay = (item: SearchResult) => {
    const params = new URLSearchParams();
    params.set('source', item.source || activeSiteKey);
    params.set('id', item.id);
    params.set('title', item.title || '');
    if (item.year) params.set('year', item.year);
    // 告诉播放页尝试优选
    params.set('prefer', 'true');
    router.push(`/play?${params.toString()}`);
  };

  return (
    <PageLayout activePath='/tvbox/explore'>
      <div className='max-w-7xl mx-auto p-4 md:p-6 space-y-6'>
        {/* Heading */}
        <div className='flex items-center gap-3'>
          <div className='w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center'>
            <Tv className='w-6 h-6 text-blue-600 dark:text-blue-400' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold text-gray-900 dark:text-white'>
              TVBox 资源浏览
            </h1>
            <p className='text-sm text-gray-600 dark:text-gray-400'>
              基于 /api/tvbox 的站点与分类，点选即可检索播放
            </p>
          </div>
        </div>

        {/* 安全状态提示 */}
        {!loadingConfig && securityConfig && (
          <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex items-start gap-3'>
            <Shield className='w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5' />
            <div className='text-sm text-blue-800 dark:text-blue-300'>
              <div className='font-semibold'>安全配置已启用</div>
              <div className='mt-1 space-y-0.5'>
                {securityConfig.enableAuth && <div>• Token 验证</div>}
                {securityConfig.enableIpWhitelist && <div>• IP 白名单</div>}
                {securityConfig.enableRateLimit && (
                  <div>• 频率限制：每分钟 {securityConfig.rateLimit} 次</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sites list */}
        <div className='bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700'>
          <div className='px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between'>
            <div className='flex items-center gap-2 font-semibold text-gray-900 dark:text-white'>
              <Server className='w-4 h-4' /> 影视源
            </div>
            <button
              className='text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 flex items-center gap-1'
              onClick={() => fetchTVBoxSites(securityConfig)}
            >
              <RefreshCw className='w-4 h-4' /> 刷新
            </button>
          </div>
          <div className='p-4'>
            {loadingSites ? (
              <div className='text-sm text-gray-500'>加载站点中...</div>
            ) : sitesError ? (
              <div className='text-sm text-red-600'>{sitesError}</div>
            ) : sites.length === 0 ? (
              <div className='text-sm text-gray-500'>暂无可用站点</div>
            ) : (
              <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                {sites.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      setActiveSiteKey(s.key);
                      const firstCat =
                        s.categories && s.categories[0] ? s.categories[0] : '';
                      setActiveCategory(firstCat);
                    }}
                    className={`text-left rounded-lg border px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      activeSiteKey === s.key
                        ? 'border-blue-500 bg-blue-50/40 dark:border-blue-500/70'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className='font-medium text-gray-900 dark:text-white flex items-center justify-between'>
                      <span>{s.name}</span>
                      <ChevronRight className='w-4 h-4 opacity-60' />
                    </div>
                    <div className='mt-1 text-xs text-gray-600 dark:text-gray-400'>
                      {s.categories && s.categories.length > 0
                        ? `${s.categories.length} 个分类`
                        : '无分类信息'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Categories & Results */}
        {activeSite && (
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700'>
            <div className='px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between'>
              <div className='flex items-center gap-2 font-semibold text-gray-900 dark:text-white'>
                <Layers className='w-4 h-4' /> {activeSite.name} 分类
              </div>
              <div className='text-xs text-gray-500 flex items-center gap-2'>
                <ListFilter className='w-4 h-4' /> 选择分类以检索
              </div>
            </div>
            <div className='p-4 space-y-4'>
              <div className='flex flex-wrap gap-2'>
                {(activeSite.categories || []).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      activeCategory === cat
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div>
                {loadingResults ? (
                  <div className='text-sm text-gray-500'>检索中...</div>
                ) : resultsError ? (
                  <div className='text-sm text-red-600'>{resultsError}</div>
                ) : results.length === 0 ? (
                  <div className='text-sm text-gray-500'>暂无结果</div>
                ) : (
                  <div className='grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
                    {results.map((item) => (
                      <div
                        key={`${item.source}-${item.id}`}
                        className='group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow bg-white dark:bg-gray-800'
                      >
                        <div className='aspect-[2/3] bg-gray-100 dark:bg-gray-700 overflow-hidden'>
                          {item.poster ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.poster}
                              alt={item.title}
                              className='w-full h-full object-cover group-hover:scale-[1.02] transition-transform'
                              loading='lazy'
                            />
                          ) : (
                            <div className='w-full h-full flex items-center justify-center text-gray-400 text-sm'>
                              无封面
                            </div>
                          )}
                        </div>
                        <div className='p-3 space-y-1'>
                          <div className='font-medium text-gray-900 dark:text-white line-clamp-1'>
                            {item.title}
                          </div>
                          <div className='text-xs text-gray-500 flex items-center justify-between'>
                            <span>{item.year || '—'}</span>
                            <span className='opacity-80'>
                              {item.source_name || activeSite.name}
                            </span>
                          </div>
                          <button
                            onClick={() => handlePlay(item)}
                            className='mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white'
                          >
                            <PlayCircle className='w-4 h-4' /> 播放
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
