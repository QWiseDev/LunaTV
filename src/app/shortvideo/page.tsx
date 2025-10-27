/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Play,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VideoItem {
  id: string;
  url: string;
  timestamp: number;
}

const createVideoId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function ShortVideoPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isTransitioning = useRef(false);
  const isFetchingRef = useRef(false);
  const pendingNextRef = useRef<number | null>(null);

  const currentVideo = videos[currentIndex];

  // 禁用页面滚动，提供沉浸体验
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const fetchVideoUrl = useCallback(async () => {
    if (isFetchingRef.current) {
      return null;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/shortvideo/fetch');
      const data = await response.json();

      if (!response.ok || !data?.success || !data?.url) {
        throw new Error(data?.message || data?.error || '获取视频失败');
      }

      const newVideo: VideoItem = {
        id: createVideoId(),
        url: data.url,
        timestamp: data.timestamp ?? Date.now(),
      };

      return newVideo;
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      setError(message);
      return null;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    let cancelled = false;

    const initVideo = async () => {
      const video = await fetchVideoUrl();
      if (video && !cancelled) {
        setVideos([video]);
        setCurrentIndex(0);
      }
    };

    initVideo();

    return () => {
      cancelled = true;
    };
  }, [fetchVideoUrl]);

  // 播放当前视频
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !currentVideo) {
      return;
    }

    element.currentTime = 0;

    const play = async () => {
      try {
        await element.play();
      } catch (err) {
        console.warn('自动播放失败，等待用户交互:', err);
      }
    };

    play();
  }, [currentVideo]);

  const resetTransition = useCallback(() => {
    setTimeout(() => {
      isTransitioning.current = false;
    }, 300);
  }, []);

  const goToNext = useCallback(async () => {
    if (isTransitioning.current || loading) return;
    if (!videos.length) return;

    isTransitioning.current = true;

    try {
      const isLast = currentIndex >= videos.length - 1;
      if (!isLast) {
        setCurrentIndex((prev) => Math.min(prev + 1, videos.length - 1));
        return;
      }

      pendingNextRef.current = currentIndex + 1;
      const newVideo = await fetchVideoUrl();
      if (newVideo) {
        setVideos((prev) => [...prev, newVideo]);
        if (pendingNextRef.current !== null) {
          setCurrentIndex(pendingNextRef.current);
        }
        pendingNextRef.current = null;
      }
    } finally {
      resetTransition();
    }
  }, [currentIndex, videos.length, loading, fetchVideoUrl, resetTransition]);

  const goToPrevious = useCallback(() => {
    if (isTransitioning.current) return;
    if (currentIndex === 0) return;

    isTransitioning.current = true;
    pendingNextRef.current = null;

    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    resetTransition();
  }, [currentIndex, resetTransition]);

  const handleVideoEnded = useCallback(async () => {
    if (autoPlay) {
      await goToNext();
    } else {
      const element = videoRef.current;
      if (element) {
        element.currentTime = 0;
        element.play().catch((err) => {
          console.error('重播失败:', err);
        });
      }
    }
  }, [autoPlay, goToNext]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY.current - touchEndY;

      if (Math.abs(diff) < 50) return;
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    },
    [goToNext, goToPrevious]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!containerRef.current) return;
      e.preventDefault();

      if (e.deltaY > 0) {
        goToNext();
      } else if (e.deltaY < 0) {
        goToPrevious();
      }
    },
    [goToNext, goToPrevious]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === ' ') {
        e.preventDefault();
        const element = videoRef.current;
        if (!element) return;
        if (element.paused) {
          element.play().catch(() => undefined);
        } else {
          element.pause();
        }
      }
    },
    [goToNext, goToPrevious]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleWheel, handleKeyDown]);

  const handleRetry = useCallback(async () => {
    const newVideo = await fetchVideoUrl();
    if (!newVideo) return;

    if (!videos.length) {
      setVideos([newVideo]);
      setCurrentIndex(0);
      pendingNextRef.current = null;
      return;
    }

    if (pendingNextRef.current !== null && pendingNextRef.current === videos.length) {
      setVideos((prev) => [...prev, newVideo]);
      const pendingIndex = pendingNextRef.current;
      pendingNextRef.current = null;
      setCurrentIndex(pendingIndex);
      return;
    }

    // 默认刷新当前视频
    setVideos((prev) => {
      if (!prev.length) return prev;
      const updated = [...prev];
      updated[currentIndex] = newVideo;
      return updated;
    });
    setCurrentIndex((prev) => Math.min(prev, videos.length - 1));
  }, [fetchVideoUrl, videos.length, currentIndex]);

  return (
    <div
      ref={containerRef}
      className='fixed inset-0 bg-black text-white overflow-hidden'
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 视频区 */}
      {currentVideo ? (
        <div className='relative w-full h-full flex items-center justify-center'>
          <video
            key={currentVideo.id}
            ref={videoRef}
            className='w-full h-full object-contain'
            src={currentVideo.url}
            autoPlay
            playsInline
            muted={muted}
            onEnded={handleVideoEnded}
            onLoadedData={() => {
              const element = videoRef.current;
              if (!element) return;
              element.play().catch(() => undefined);
            }}
            onClick={() => {
              const element = videoRef.current;
              if (!element) return;
              if (element.paused) {
                element.play().catch(() => undefined);
              } else {
                element.pause();
              }
            }}
          />
        </div>
      ) : (
        <div className='absolute inset-0 flex flex-col items-center justify-center gap-4'>
          <Loader2 className='w-10 h-10 animate-spin' />
          <p className='text-sm text-white/70'>正在加载短视频...</p>
        </div>
      )}

      {/* 控制按钮 */}
      <div className='absolute right-4 bottom-24 md:bottom-12 flex flex-col gap-4 z-20'>
        <button
          onClick={() => setMuted((prev) => !prev)}
          className={`group relative w-14 h-14 rounded-full backdrop-blur-md transition-all duration-300 ${
            muted ? 'bg-white/20 hover:bg-white/30' : 'bg-green-500/80 hover:bg-green-500'
          }`}
          title={muted ? '点击开启声音' : '点击关闭声音'}
        >
          {muted ? (
            <VolumeX className='w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
          ) : (
            <Volume2 className='w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
          )}
          <div className='absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'>
            <div className='bg-black/80 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap'>
              {muted ? '静音' : '声音已开'}
            </div>
          </div>
        </button>

        <button
          onClick={() => setAutoPlay((prev) => !prev)}
          className={`group relative w-14 h-14 rounded-full backdrop-blur-md transition-all duration-300 ${
            autoPlay ? 'bg-green-500/80 hover:bg-green-500' : 'bg-white/20 hover:bg-white/30'
          }`}
          title={autoPlay ? '自动连播：开启' : '自动连播：关闭'}
        >
          {autoPlay ? (
            <Play className='w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
          ) : (
            <RotateCw className='w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
          )}
          <div className='absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'>
            <div className='bg-black/80 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap'>
              {autoPlay ? '自动播放下一个' : '单个视频循环'}
            </div>
          </div>
        </button>

        <div className='bg-white/20 backdrop-blur-md rounded-full px-4 py-2'>
          <p className='text-white text-sm font-medium'>
            {videos.length ? `${currentIndex + 1}/${videos.length}` : '0/0'}
          </p>
        </div>
      </div>

      {/* 底部提示 */}
      <div className='absolute bottom-28 md:bottom-16 left-4 right-4 z-20'>
        <div className='flex items-center justify-between gap-4'>
          <div className='flex gap-2'>
            {currentIndex > 0 && (
              <button
                onClick={goToPrevious}
                className='hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-full transition-colors'
              >
                <ArrowUp className='w-4 h-4' />
                <span className='text-sm'>上一个</span>
              </button>
            )}
            <button
              onClick={goToNext}
              className='hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-full transition-colors'
            >
              <ArrowDown className='w-4 h-4' />
              <span className='text-sm'>下一个</span>
            </button>
          </div>

          <div className='md:hidden flex items-center gap-2 bg-white/10 backdrop-blur-md text-white/70 px-4 py-2 rounded-full text-xs'>
            <ArrowUp className='w-3 h-3' />
            <span>上下滑动切换</span>
            <ArrowDown className='w-3 h-3' />
          </div>
        </div>
      </div>

      {/* PC端提示 */}
      <div className='hidden md:block absolute top-6 left-1/2 -translate-x-1/2 z-20'>
        <div className='bg-white/10 backdrop-blur-md text-white/70 px-4 py-2 rounded-full text-xs'>
          使用 ↑↓ 键或滚轮切换视频，空格键暂停/播放
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30'>
          <div className='flex flex-col items-center gap-3'>
            <Loader2 className='w-12 h-12 text-white animate-spin' />
            <p className='text-white text-sm'>加载中...</p>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 px-6'>
          <div className='w-full max-w-sm bg-white/10 border border-white/20 rounded-2xl p-6 text-center space-y-4'>
            <p className='text-sm leading-relaxed text-white/90'>{error}</p>
            <button
              onClick={handleRetry}
              className='w-full px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors'
            >
              重试
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
