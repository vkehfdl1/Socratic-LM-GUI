import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { updateChatLastContextById } from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
// REDIS DISABLED: Commenting out resumable-stream imports
// import {
//   createResumableStreamContext,
//   type ResumableStreamContext,
// } from 'resumable-stream';
// REDIS DISABLED: after import not needed anymore
// import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { unstable_cache as cache } from 'next/cache';
import { fetchModels } from 'tokenlens/fetch';
import { getUsage } from 'tokenlens/helpers';
import type { ModelCatalog } from 'tokenlens/core';
import type { AppUsage } from '@/lib/usage';

export const maxDuration = 60;

const supposeProblemSystemPrompt = `1. 역할 및 페르소나 (Role & Persona)
당신은 사용자의 논리적 사고력과 추론 능력을 자극하는 **'소크라틱 추론 가이드(Socratic Reasoning Guide)'**입니다. 당신의 유일한 임무는 정답을 알려주는 것이 아니라, 사용자가 스스로 거대한 페르미 문제를 해결할 수 있도록 결정적이고 개방적인 질문을 던지는 것입니다. 당신의 말투는 친절하고, 격려적이며, 사용자의 아이디어를 존중해야 합니다.

2. 핵심 임무 및 실험적 맥락 (Core Task & Context)
당신은 사용자에게 **"우리나라(혹은 서울시) 사람들은 하루에 총 몇 리터의 커피를 마실까?"**라는 페르미 문제를 제시합니다. 사용자는 당신의 질문에 답하기 전에 5초 또는 30초의 의도적인 대기 시간을 갖게 됩니다.

당신의 가장 중요한 임무는, 이 대기 시간이 '지루한 시간'이 아닌 '가치 있는 사고의 시간'이 되도록 만드는 것입니다. 이를 위해 당신의 질문은 사용자가 머릿속으로 전략을 세우고, 분류하고, 상상하도록 만드는 **'생성형 질문(Generative Questions)'**이어야 합니다.

3. 핵심 원칙 및 제약 조건 (Principles & Constraints)
[원칙 1] 사고를 유발하는 '생성형 질문': 절대 "예/아니오"로 답할 수 있는 질문을 하지 마십시오.

[원칙 2] 절대 수치나 데이터를 제공하지 마시오: 사용자가 "우리나라 인구가 몇 명인가요?"라고 물으면, 당신은 "훌륭한 질문입니다. 이 문제를 풀기 위해 어떤 숫자를 '합리적인 가정'으로 설정해 볼까요?"라고 되물어야 합니다.

[원칙 3] 한 번에 하나의 질문만 하시오: 사용자가 30초 동안 집중할 수 있도록 하나의 명확한 질문만 던집니다.

[원칙 4] 정답이 아닌 '과정'을 칭찬하시오: "좋은 추측입니다", "훌륭한 분류 기준이네요", "논리적인 접근입니다"와 같이 사용자의 사고 과정 자체를 격려합니다.

[원칙 5] 사용자의 답변을 재확인하고 다음 단계로 연결하시오: 사용자의 답변을 요약하여 되짚어주고, 그것을 기반으로 다음 질문을 던져 대화의 흐름을 만듭니다.`;

const supposeProblemExamplePrompt = `소크라틱 대화 구조 (4-Step Socratic Logic Flow)
[대화 시작] "안녕하세요. 오늘은 아주 흥미로운 문제를 함께 풀어보겠습니다. **'우리나라 사람들은 하루에 총 몇 리터의 커피를 마실까?'**라는 질문을 보니, 어떤 생각이 드시나요?"

[Phase 1: 문제 분해 및 전략 수립 (Decomposition & Strategy)]

챗봇 (사용자가 막연함을 표현하면): "맞습니다. 정말 막연하게 느껴지죠. 이 문제를 풀 수 있는 접근법은 크게 두 가지가 있습니다. (1) **'사람'**에서 시작해서 총 **마시는 양(수요)**을 추정하거나, (2) **'커피가 팔리는 곳'**에서 시작해서 총 **공급되는 양(공급)**을 추정하는 것이죠."

챗봇 (핵심 질문 1): "이 두 가지 접근법 중, 어떤 방식이 더 합리적인 추론을 하기에 쉬울까요? 아니면 두 가지 모두 사용해서 결과를 비교해 볼까요?"

[Phase 2: 변수 정의 (Variable Definition)]

챗봇 (사용자가 '사람(수요)'을 선택하면): "좋습니다. '사람'에서 시작하는 수요 측면으로 접근해 보죠. '하루 총 커피 음용량'이라는 답을 구하기 위해, 우리는 어떤 핵심 변수(숫자)들을 곱해야 할까요?"

[Phase 3: 가정 및 추론 (Assumption & Estimation)]

챗봇 (사용자가 '총인구', '마시는 비율', '1인당 음용량' 등을 언급하면): "정확합니다! '총인구', '커피 마시는 비율', '1인당 하루 음용량'이 필요하겠네요."

챗봇 (핵심 질문 2): "그럼 이 변수들에 대해 하나씩 합리적인 **가정(추측)**을 해볼 시간입니다. '우리나라 인구 중 커피를 마시는 사람의 비율'은 몇 % 정도로 추정해 볼 수 있을까요?"

챗봇 (사용자가 비율을 가정하면): "좋습니다. O%로 가정하죠. 그럼 그 커피를 마시는 사람들은 '하루 평균' 몇 잔의 커피를 마실까요? 그리고 커피 1잔의 부피는 몇 ml(리터)로 가정해야 할까요?"

[Phase 4: 종합 및 계산 (Synthesis & Calculation)]

챗봇 (사용자가 모든 가정을 마치면): "훌륭합니다. 이제 모든 조각이 모였습니다. [사용자가 추정한 변수들을 요약]. 이제 이 값들을 모두 조합하여 '우리나라 사람들이 하루에 마시는 커피의 총량(리터)'을 계산해 주세요."

챗봇 (사용자가 계산을 완료하면): "방금 당신이 사용한 그 논리적인 방식으로, 이번에는 **'공급' 측면(예: 전국 카페 수 x 하루 평균 판매량)**으로도 계산해서 두 결과가 비슷한지 교차 검증을 해볼 수도 있겠네요. 정말 훌륭한 추론 과정이었습니다!"`;

// REDIS DISABLED: Global stream context is now disabled
// let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        'TokenLens: catalog fetch failed, using default catalog',
        err,
      );
      return undefined; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ['tokenlens-catalog'],
  { revalidate: 24 * 60 * 60 }, // 24 hours
);

// REDIS DISABLED: getStreamContext function is now disabled
export function getStreamContext() {
  // REDIS DISABLED: Always return null to disable resumable streams
  return null;

  /* ORIGINAL REDIS CODE - COMMENTED OUT:
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
  */
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      selectedProblemType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
      selectedProblemType: 'math' | 'fermi';
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });

    function createSupposeTypeExamples(): ChatMessage[] {
      return [
        {
          id: generateUUID(),
          role: 'system' as const,
          parts: [{ type: 'text' as const, text: supposeProblemSystemPrompt }],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'system' as const,
          parts: [{ type: 'text' as const, text: supposeProblemExamplePrompt }],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [
            {
              type: 'text' as const,
              text: '이제 학생이 페르미 문제를 물어볼 차례입니다. 앞으로 입력될 페르미 문제를 앞의 지시사항에 따라서 순차적으로 푸는 것을 도와주세요.',
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
      ];
    }

    function createFewShotExamples(): ChatMessage[] {
      return [
        {
          id: generateUUID(),
          role: 'system' as const,
          parts: [{ type: 'text' as const, text: 'Example 1' }],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [
            {
              type: 'text' as const,
              text: '숫자 1,2,3,4,5 중에서 서로 다른 4개를 택해 일렬로 나열하여 만들 수 있는 모든 네 자리 자연수 중에서 임의로 하나의 수를 택할 때, 택한 수가 5의 배수 또는 3500 이상일 확률은?',
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'assistant' as const,
          parts: [
            {
              type: 'text' as const,
              text: `<PROGRESS>0.0</PROGRESS>
              먼저 전체 경우의 수를 계산해야 합니다. 1,2,3,4,5 중 서로 다른 4개를 택할 수 있는 경우의 수는 어떻게 되나요?
              `,
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [
            {
              type: 'text' as const,
              text: '전체 경우의 수는 5*4*3*2 = 120 입니다.',
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'assistant' as const,
          parts: [
            {
              type: 'text' as const,
              text: `<PROGRESS>0.1</PROGRESS>
              정확합니다! 이제 네 자리 자연수 중에서 5의 배수인 경우를 생각해 봅시다. 네 자리 자연수가 5의 배수가 되려면 끝 자리 수가 0 또는 5여야겠죠? 그렇다면 5의 배수인 경우의 수는 어떻게 되나요?`,
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [
            {
              type: 'text' as const,
              text: '마지막 자리 수가 0이 될 수는 없죠... 마지막 수가 5라면 4개 중 3개를 택해서 나열하는 경우의 수와 같아요. 그러면 4*3*2=24 입니다.',
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'assistant' as const,
          parts: [
            {
              type: 'text' as const,
              text: `<PROGRESS>0.3</PROGRESS>
              잘했어요! 이제 3500 이상인 경우를 생각해 봅시다. 네 자리 자연수가 3500 이상이 되려면 첫 자리 수가 3, 4, 5 중 하나여야겠죠? 그렇다면 3500 이상인 경우의 수는 어떻게 되나요?`,
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [
            {
              type: 'text' as const,
              text: '일단 앞자리가 4나 5인 경우의 수는... 48? 근데 3일때는 다 되는 것이 아니잖아',
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'assistant' as const,
          parts: [
            {
              type: 'text' as const,
              text: `<PROGRESS>0.5</PROGRESS>
              맞습니다. 앞 자리가 3일때에 대한 힌트를 조금 더 드리죠. 앞자리가 3이고, 두 번째 자리가 5인 경우는 모두 3500 이상이 됩니다. 이 경우의 수는 어떻게 되나요?`,
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [
            {
              type: 'text' as const,
              text: '그러면 3,5 다음에 두 자리만 결정하면 되니깐, 3개 중 2개 고르기. 그러면 6이고 총 54겠네.',
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'assistant' as const,
          parts: [
            {
              type: 'text' as const,
              text: `<PROGRESS>0.7</PROGRESS>
              맞습니다. 그러면 두 경우의 수 중 겹치는, 즉 동시에 5의 배수이면서 3500 이상인 경우의 수를 빼주어야 합니다. 이 경우는 어떻게 되나요?`,
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [
            {
              type: 'text' as const,
              text: '끝자리가 5, 앞쪽이 4나 5여야겠네. 근데 5가 하나니깐 앞 쪽이 4. 그러니깐 6개.',
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'assistant' as const,
          parts: [
            {
              type: 'text' as const,
              text: `<PROGRESS>0.9</PROGRESS>
              정확해요. 거의 다 풀었군요. 이제 총 경우의 수와 앞에서 구한 경우의 수를 통해서 최종 확률을 구해보세요.`,
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [
            { type: 'text' as const, text: '그러면 5분의 3이 답이 되겠군.' },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'assistant' as const,
          parts: [
            {
              type: 'text' as const,
              text: `<PROGRESS>1.0</PROGRESS>
              정답입니다. 5분의 3이 최종 확률이 되겠네요. 수고했어요!`,
            },
          ],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'system' as const,
          parts: [{ type: 'text' as const, text: 'Example 2' }],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
      ];
    }

    const fewShotExamples = createFewShotExamples();
    const supposeSystemPrompts = createSupposeTypeExamples();

    console.log('Selected Problem Type:', selectedProblemType);

    const problemTypePrompts =
      selectedProblemType === 'math' ? fewShotExamples : supposeSystemPrompts;

    console.log(
      'Using prompts:',
      selectedProblemType === 'math'
        ? 'Math (fewShotExamples)'
        : 'Fermi (supposeSystemPrompts)',
    );

    // Only add problem type prompts if this is the first message (no messages from DB)
    const uiMessages =
      messagesFromDb.length === 0
        ? [
            ...convertToUIMessages(messagesFromDb),
            ...problemTypePrompts,
            message,
          ]
        : [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: 'data-usage',
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: 'data-usage',
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: 'data-usage', data: finalMergedUsage });
            } catch (err) {
              console.warn('TokenLens enrichment failed', err);
              finalMergedUsage = usage;
              dataStream.write({ type: 'data-usage', data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn('Unable to persist last usage for chat', id, err);
          }
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    // REDIS DISABLED: streamContext will always be null, so we use the fallback path
    if (streamContext) {
      // REDIS DISABLED: This code path will never be reached since streamContext is always null
      // The original resumable stream code would be here but is disabled
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    } else {
      // This path is now always used since Redis is disabled
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        'AI Gateway requires a valid credit card on file to service requests',
      )
    ) {
      return new ChatSDKError('bad_request:activate_gateway').toResponse();
    }

    console.error('Unhandled error in chat API:', error);
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
