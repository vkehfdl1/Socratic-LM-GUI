'use client';

import { cn } from '@/lib/utils';
import { memo } from 'react';
import { BookOpenIcon, CheckCircleIcon } from 'lucide-react';

interface LearningProgressProps {
  progress: number; // 0-1 range
  className?: string;
  isVisible?: boolean;
}

export const LearningProgress = memo(
  ({ progress, className, isVisible = true }: LearningProgressProps) => {
    // Clamp progress to 0-1 range
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const percentage = Math.round(clampedProgress * 100);

    if (!isVisible) {
      return null;
    }

    return (
      <div
        className={cn(
          'w-full rounded-lg border bg-card p-4 shadow-sm',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            {clampedProgress >= 1 ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <BookOpenIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className='font-medium text-foreground text-sm'>
                {clampedProgress >= 1 ? '학습 완료' : '학습 진행 중...'}
              </h3>
              <span className='font-medium text-muted-foreground text-sm'>
                {percentage}%
              </span>
            </div>

            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className={cn(
                  'h-2 rounded-full transition-all duration-500 ease-out',
                  clampedProgress >= 1
                    ? 'bg-green-500'
                    : 'bg-gradient-to-r from-blue-500 to-purple-500',
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {clampedProgress < 1 && (
              <p className='mt-1 text-muted-foreground text-xs'>
                AI가 답변을 생성하고 있습니다...
              </p>
            )}

            {clampedProgress >= 1 && (
              <p className='mt-1 text-muted-foreground text-xs'>
                학습이 완료되었습니다
              </p>
            )}
          </div>
        </div>
      </div>
    );
  },
);

LearningProgress.displayName = 'LearningProgress';
