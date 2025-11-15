'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { toast } from './toast';

interface BoredomButtonProps {
  hasMessages: boolean; // 메시지가 하나라도 있는지 여부
}

const encouragementMessages = [
  '조금만 더 기다려보세요! 좋은 답변이 오고 있어요 🤔',
  '생각할 시간도 필요하답니다! 잠시만요 ⏰',
  '심호흡 한 번 하고 기다려볼까요? 😌',
  '좋은 답변을 위해 열심히 생각 중이에요! 💭',
  '기다림은 곧 보상으로 돌아올 거예요! ✨',
  '잠깐! 천천히 생각하는 것도 중요해요 🧠',
  '조금만 더요! 거의 다 왔어요 🚀',
  '인내심을 가져보세요! 😊',
];

export function BoredomButton({ hasMessages }: BoredomButtonProps) {
  const [clickCount, setClickCount] = useState(0);

  const handleClick = () => {
    // 클릭 카운트 증가
    const newCount = clickCount + 1;
    setClickCount(newCount);

    // 랜덤 메시지 선택
    const randomMessage =
      encouragementMessages[
        Math.floor(Math.random() * encouragementMessages.length)
      ];

    // 토스트 메시지 표시
    toast({
      type: 'success',
      description: randomMessage,
    });
  };

  // 메시지가 없으면 버튼을 표시하지 않음
  if (!hasMessages) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-32 z-50 flex flex-col items-end gap-2 md:right-8 md:bottom-24">
      {/* 통계 정보 */}
      {clickCount > 0 && (
        <div className="flex flex-col items-end gap-1 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-400">
          <div className="font-medium text-[11px] text-zinc-700 dark:text-zinc-300">
            클릭 횟수: {clickCount}회
          </div>
        </div>
      )}

      {/* 메인 버튼 */}
      <Button
        onClick={handleClick}
        variant="outline"
        size="sm"
        className="animate-bounce shadow-lg transition-all hover:scale-105 hover:shadow-xl"
      >
        <span className="text-sm">심심하면 누르세요 😴</span>
      </Button>
    </div>
  );
}
