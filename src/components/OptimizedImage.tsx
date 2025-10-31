'use client';

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
  quality?: number;
}

/**
 * 优化的图片组件
 * - 使用 Next.js Image 组件
 * - 懒加载
 * - 占位符
 * - 错误处理
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  fill = false,
  sizes,
  quality = 75,
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (imageError || !src) {
    return (
      <div
        className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <svg
          className="w-12 h-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  const imageProps: any = {
    src,
    alt,
    className: `${className} ${loading ? 'blur-sm' : 'blur-0'} transition-all duration-300`,
    onError: () => setImageError(true),
    onLoadingComplete: () => setLoading(false),
    quality,
    loading: priority ? 'eager' : 'lazy',
  };

  if (fill) {
    imageProps.fill = true;
    imageProps.sizes = sizes || '100vw';
  } else {
    imageProps.width = width;
    imageProps.height = height;
  }

  if (priority) {
    imageProps.priority = true;
  }

  return <Image {...imageProps} />;
}
