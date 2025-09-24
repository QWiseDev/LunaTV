/* eslint-disable react-hooks/exhaustive-deps */

import { Clock, Target, Tv, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';

import { formatTimeToHHMM, parseCustomTimeFormat } from '@/lib/time';

interface EpgProgram {
  start: string;
  end: string;
  title: string;
}

interface EpgScrollableRowProps {
  programs: EpgProgram[];
  currentTime?: Date;
  isLoading?: boolean;
}

export default function EpgScrollableRow({
  programs,
  currentTime = new Date(),
  isLoading = false,
}: EpgScrollableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number>(-1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });

  // 检查滚动状态
  const checkScrollState = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // 滚动到指定位置
  const scrollTo = useCallback((direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const scrollAmount = container.clientWidth * 0.8; // 滚动80%的可视宽度
    
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }, []);

  // 自动滚动到正在播放的节目
  const scrollToCurrentProgram = useCallback(() => {
    if (!containerRef.current || currentPlayingIndex === -1) return;
    
    const container = containerRef.current;
    const programElements = container.children;
    const targetElement = programElements[currentPlayingIndex] as HTMLElement;
    
    if (targetElement) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      
      // 计算目标元素相对于容器的位置
      const targetLeft = targetElement.offsetLeft;
      const targetWidth = targetElement.offsetWidth;
      const containerWidth = container.clientWidth;
      
      // 计算滚动位置，使目标元素居中
      const scrollLeft = targetLeft - (containerWidth / 2) + (targetWidth / 2);
      
      container.scrollTo({
        left: Math.max(0, Math.min(scrollLeft, container.scrollWidth - containerWidth)),
        behavior: 'smooth'
      });
    }
  }, [currentPlayingIndex]);

  // 鼠标拖拽处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.pageX,
      scrollLeft: containerRef.current.scrollLeft
    });
    
    // 阻止文本选择
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    e.preventDefault();
    const x = e.pageX;
    const walk = (x - dragStart.x) * 2; // 增加拖拽敏感度
    containerRef.current.scrollLeft = dragStart.scrollLeft - walk;
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 触摸事件处理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const touch = e.touches[0];
    setDragStart({
      x: touch.pageX,
      scrollLeft: containerRef.current.scrollLeft
    });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const touch = e.touches[0];
    const walk = (touch.pageX - dragStart.x) * 1.5; // 触摸拖拽敏感度
    containerRef.current.scrollLeft = dragStart.scrollLeft - walk;
  }, [dragStart]);

  // 滚轮事件处理 - 简化版本
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!containerRef.current) return;
    
    // 检查是否有横向滚动空间
    const container = containerRef.current;
    const hasHorizontalScroll = container.scrollWidth > container.clientWidth;
    
    if (hasHorizontalScroll) {
      e.preventDefault();
      
      // 将垂直滚动转换为水平滚动
      const scrollAmount = e.deltaY * 2;
      container.scrollLeft += scrollAmount;
    }
  }, []);

  // 监听滚动事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      checkScrollState();
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // 初始检查
    checkScrollState();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [checkScrollState]);

  // 组件加载后自动滚动到正在播放的节目
  useEffect(() => {
    const timer = setTimeout(() => {
      const initialPlayingIndex = programs.findIndex(program => isCurrentlyPlaying(program));
      setCurrentPlayingIndex(initialPlayingIndex);

      // 直接执行滚动逻辑，不依赖状态更新
      if (initialPlayingIndex !== -1 && containerRef.current) {
        const container = containerRef.current;
        const programElements = container.children;
        const targetElement = programElements[initialPlayingIndex] as HTMLElement;

        if (targetElement) {
          const targetLeft = targetElement.offsetLeft;
          const targetWidth = targetElement.offsetWidth;
          const containerWidth = container.clientWidth;

          const scrollLeft = targetLeft - (containerWidth / 2) + (targetWidth / 2);

          container.scrollTo({
            left: Math.max(0, Math.min(scrollLeft, container.scrollWidth - containerWidth)),
            behavior: 'smooth'
          });
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [programs, currentTime]);

  // 定时刷新正在播放状态
  useEffect(() => {
    const interval = setInterval(() => {
      const newPlayingIndex = programs.findIndex(program => {
        try {
          const start = parseCustomTimeFormat(program.start);
          const end = parseCustomTimeFormat(program.end);
          return currentTime >= start && currentTime < end;
        } catch {
          return false;
        }
      });

      if (newPlayingIndex !== currentPlayingIndex) {
        setCurrentPlayingIndex(newPlayingIndex);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [programs, currentTime, currentPlayingIndex]);

  // 格式化时间显示
  const formatTime = (timeString: string) => {
    return formatTimeToHHMM(timeString);
  };

  // 判断节目是否正在播放
  const isCurrentlyPlaying = (program: EpgProgram) => {
    try {
      const start = parseCustomTimeFormat(program.start);
      const end = parseCustomTimeFormat(program.end);
      return currentTime >= start && currentTime < end;
    } catch {
      return false;
    }
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className="pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            今日节目单
          </h4>
          <div className="w-16 sm:w-20"></div>
        </div>
        <div className="min-h-[100px] sm:min-h-[120px] flex items-center justify-center">
          <div className="flex items-center gap-3 sm:gap-4 text-gray-500 dark:text-gray-400">
            <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm sm:text-base">加载节目单...</span>
          </div>
        </div>
      </div>
    );
  }

  // 无节目单状态
  if (!programs || programs.length === 0) {
    return (
      <div className="pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            今日节目单
          </h4>
          <div className="w-16 sm:w-20"></div>
        </div>
        <div className="min-h-[100px] sm:min-h-[120px] flex items-center justify-center">
          <div className="flex items-center gap-2 sm:gap-3 text-gray-400 dark:text-gray-500">
            <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">暂无节目单数据</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 mt-2">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
          今日节目单
        </h4>
        <div className="flex items-center gap-2">
          {currentPlayingIndex !== -1 && (
            <button
              onClick={scrollToCurrentProgram}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 bg-gray-300/50 dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-all duration-200"
              title="滚动到当前播放位置"
            >
              <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">当前播放</span>
              <span className="sm:hidden">当前</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative group">
        {/* 左侧滚动按钮 */}
        {canScrollLeft && (
          <button
            onClick={() => scrollTo('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
            title="向左滚动"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        {/* 右侧滚动按钮 */}
        {canScrollRight && (
          <button
            onClick={() => scrollTo('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
            title="向右滚动"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        {/* 节目单容器 */}
        <div
          ref={containerRef}
          className={`flex overflow-x-auto scrollbar-hide py-2 pb-4 px-2 sm:px-4 min-h-[100px] sm:min-h-[120px] gap-3 sm:gap-4 ${
            isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
          }`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {programs.map((program, index) => {
            const isPlaying = index === currentPlayingIndex;
            const isFinishedProgram = index < currentPlayingIndex;
            const isUpcomingProgram = index > currentPlayingIndex;

            return (
              <div
                key={index}
                className={`flex-shrink-0 w-36 sm:w-48 p-2 sm:p-3 rounded-lg border transition-all duration-200 flex flex-col min-h-[100px] sm:min-h-[120px] ${
                  isPlaying
                    ? 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30 shadow-md'
                    : isFinishedProgram
                      ? 'bg-gray-300/50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-75'
                      : isUpcomingProgram
                        ? 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                }`}
              >
                {/* 时间显示在顶部 */}
                <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
                  <span className={`text-xs font-medium ${
                    isPlaying
                      ? 'text-green-600 dark:text-green-400'
                      : isFinishedProgram
                        ? 'text-gray-500 dark:text-gray-400'
                        : isUpcomingProgram
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-300'
                  }`}>
                    {formatTime(program.start)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTime(program.end)}
                  </span>
                </div>

                {/* 标题在中间，占据剩余空间 */}
                <div
                  className={`text-xs sm:text-sm font-medium flex-1 leading-relaxed ${
                    isPlaying
                      ? 'text-green-900 dark:text-green-100'
                      : isFinishedProgram
                        ? 'text-gray-600 dark:text-gray-400'
                        : isUpcomingProgram
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-gray-900 dark:text-gray-100'
                  }`}
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.4',
                    maxHeight: '4.2em'
                  }}
                  title={program.title}
                >
                  {program.title}
                </div>

                {/* 正在播放状态在底部 */}
                {isPlaying && (
                  <div className="mt-auto pt-1 sm:pt-2 flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      正在播放
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 滚动提示 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-gray-800/80 dark:bg-gray-200/80 text-white dark:text-gray-800 text-xs px-2 py-1 rounded backdrop-blur-sm">
            可滚动查看更多节目
          </div>
        </div>
      </div>
    </div>
  );
}
