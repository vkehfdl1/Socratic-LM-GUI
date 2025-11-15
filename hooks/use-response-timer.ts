'use client';

import { useState, useEffect, useRef } from 'react';

export function useResponseTimer() {
  const [startTime, setStartTime] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // LLM 응답이 완료되면 타이머 시작
  const startTimer = () => {
    setStartTime(Date.now());
  };

  // 사용자가 메시지를 보낼 때 경과 시간 계산 및 타이머 리셋
  const stopTimer = (): number | null => {
    if (startTime === null) return null;

    const elapsedTime = (Date.now() - startTime) / 1000; // 초 단위
    setStartTime(null);
    return elapsedTime;
  };

  // 타이머 리셋
  const resetTimer = () => {
    setStartTime(null);
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    startTimer,
    stopTimer,
    resetTimer,
    isTimerRunning: startTime !== null,
    startTime,
  };
}
