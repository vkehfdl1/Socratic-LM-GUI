'use client';

import { useState, useEffect } from 'react';

export function useThinkingTimer(duration: number) {
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const [remainingTime, setRemainingTime] = useState(duration);

  useEffect(() => {
    if (!isTimerActive || remainingTime <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime((prevTime) => {
        if (prevTime <= 1) {
          setIsTimerActive(false);
          return duration;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerActive, remainingTime, duration]);

  const startTimer = () => {
    if (!isTimerStarted && duration > 0) {
      setIsTimerStarted(true);
      setIsTimerActive(true);
      setRemainingTime(duration);
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
