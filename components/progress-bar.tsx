'use client';

import { cn } from '@/lib/utils';
import { memo } from 'react';

interface ProgressBarProps {
  progress: number; // 0-1 range
  className?: string;
  isVisible?: boolean;
}

export const ProgressBar = memo(
  ({ progress, className, isVisible = true }: ProgressBarProps) => {
    // Clamp progress to 0-1 range
    const clampedProgress = Math.max(0, Math.min(1, progress));

    if (!isVisible) {
      return null;
    }

    return (
      <div
        className={cn('mb-3 h-2 w-full rounded-full bg-gray-200', className)}
      >
        <div
          className="h-2 rounded-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress * 100}%` }}
        />
      </div>
    );
  },
);

ProgressBar.displayName = 'ProgressBar';
