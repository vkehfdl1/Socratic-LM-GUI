import { PreviewMessage, ThinkingMessage } from './message';
import { Greeting } from './greeting';
import { memo, useEffect, useMemo } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { useMessages } from '@/hooks/use-messages';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { Conversation, ConversationContent } from './elements/conversation';
import { ArrowDownIcon } from 'lucide-react';
import { LearningProgress } from './learning-progress';
import { extractProgress, getTextFromMessage } from '@/lib/utils';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>['status'];
  votes: Array<Vote> | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  selectedModelId: string;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  selectedModelId,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  useDataStream();

  // Extract the latest progress from all assistant messages
  const currentProgress = useMemo(() => {
    // 메시지가 없으면 null 반환
    if (messages.length === 0) return null;

    // 기본값을 0으로 설정 (학습 시작)
    let latestProgress = 0;

    // 현재 스트리밍 중이면 기본 진행도 표시
    if (status === 'streaming') {
      latestProgress = 0.1; // 시작 진행도
    }

    // Go through messages in reverse to get the most recent progress
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant') {
        const messageText = getTextFromMessage(message);
        const progress = extractProgress(messageText);
        if (progress !== null) {
          latestProgress = progress;
          break;
        }
      }
    }

    return latestProgress;
  }, [messages, status]);

  useEffect(() => {
    if (status === 'submitted') {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        }
      });
    }
  }, [status, messagesContainerRef]);

  return (
    <div
      ref={messagesContainerRef}
      className="overscroll-behavior-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y overflow-y-scroll"
      style={{ overflowAnchor: 'none' }}
    >
      {/* Global learning progress at the top */}
      {currentProgress !== null && (
        <div className="sticky top-0 z-10 mx-auto w-full max-w-4xl bg-background px-2 pt-2 md:px-4">
          <LearningProgress progress={currentProgress} />
        </div>
      )}

      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 md:gap-6">
        <ConversationContent className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
          {messages.length === 0 && <Greeting />}

          {messages.map((message, index) => (
            <PreviewMessage
              key={message.id}
              chatId={chatId}
              message={message}
              isLoading={
                status === 'streaming' && messages.length - 1 === index
              }
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
              setMessages={setMessages}
              regenerate={regenerate}
              isReadonly={isReadonly}
              requiresScrollPadding={
                hasSentMessage && index === messages.length - 1
              }
              isArtifactVisible={isArtifactVisible}
            />
          ))}

          {status === 'submitted' &&
            messages.length > 0 &&
            messages[messages.length - 1].role === 'user' &&
            selectedModelId !== 'chat-model-reasoning' && <ThinkingMessage />}

          <div
            ref={messagesEndRef}
            className="min-h-[24px] min-w-[24px] shrink-0"
          />
        </ConversationContent>
      </Conversation>

      {!isAtBottom && (
        <button
          className="-translate-x-1/2 absolute bottom-40 left-1/2 z-10 rounded-full border bg-background p-2 shadow-lg transition-colors hover:bg-muted"
          onClick={() => scrollToBottom('smooth')}
          type="button"
          aria-label="Scroll to bottom"
        >
          <ArrowDownIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return false;
});
