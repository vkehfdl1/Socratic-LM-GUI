'use client';

import { useState, useEffect } from 'react';

export const THINKING_TIMER_DURATION = 5; // 5 seconds

export function useThinkingTimer() {
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const [remainingTime, setRemainingTime] = useState(THINKING_TIMER_DURATION);

  useEffect(() => {
    if (!isTimerActive || remainingTime <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime((prevTime) => {
        if (prevTime <= 1) {
          setIsTimerActive(false);
          return THINKING_TIMER_DURATION;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerActive, remainingTime]);

  const startTimer = () => {
    if (!isTimerStarted) {
      setIsTimerStarted(true);
      setIsTimerActive(true);
      setRemainingTime(THINKING_TIMER_DURATION);
    }
  };

  const resetTimerStarted = () => {
    setIsTimerStarted(false);
  };

  return {
    isTimerActive,
    remainingTime,
    startTimer,
    resetTimerStarted,
    isTimerStarted,
  };
}
