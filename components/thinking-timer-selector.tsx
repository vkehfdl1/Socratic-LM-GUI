'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClockRewind } from './icons';

export type ThinkingTimerDuration = 0 | 5 | 30;

interface ThinkingTimerSelectorProps {
  selectedDuration: ThinkingTimerDuration;
  onDurationChange: (duration: ThinkingTimerDuration) => void;
  className?: string;
}

export function ThinkingTimerSelector({
  selectedDuration,
  onDurationChange,
  className,
}: ThinkingTimerSelectorProps) {
  return (
    <Select
      value={selectedDuration.toString()}
      onValueChange={(value) =>
        onDurationChange(Number(value) as ThinkingTimerDuration)
      }
    >
      <SelectTrigger className={`h-8 w-fit gap-2 px-2 ${className}`}>
        <ClockRewind size={14} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">No Delay</SelectItem>
        <SelectItem value="5">5 seconds</SelectItem>
        <SelectItem value="30">30 seconds</SelectItem>
      </SelectContent>
    </Select>
  );
}
