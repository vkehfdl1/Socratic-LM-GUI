'use client';

import { cn } from '@/lib/utils';

interface ThinkingTimerProps {
  remainingTime: number;
  isActive: boolean;
}

const thinkingInstructions = [
  "Take a moment to reflect on the AI's response",
  'What questions come to your mind?',
  'How can you build upon this information?',
  'Consider different perspectives',
];

export function ThinkingTimer({ remainingTime, isActive }: ThinkingTimerProps) {
  if (!isActive) return null;

  return (
    <div className='fade-in flex animate-in flex-col items-center gap-2 p-4 text-muted-foreground text-sm'>
      <div className="font-medium text-base">
        Time remaining: {remainingTime}s
      </div>
      <div
        className={cn(
          'text-center opacity-80 transition-all duration-300',
          remainingTime <= 2 && 'scale-105 text-primary',
        )}
      >
        {
          thinkingInstructions[
            Math.floor((remainingTime - 1) / 2) % thinkingInstructions.length
          ]
        }
      </div>
    </div>
  );
}
