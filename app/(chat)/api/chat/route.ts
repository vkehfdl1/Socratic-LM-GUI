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
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
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

    function createFewShotExamples(): ChatMessage[] {
      return [
        {
          id: generateUUID(),
          role: 'system' as const,
          parts: [{type: 'text' as const, text: 'Example 1'}],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: '숫자 1,2,3,4,5 중에서 서로 다른 4개를 택해 일렬로 나열하여 만들 수 있는 모든 네 자리 자연수 중에서 임의로 하나의 수를 택할 때, 택한 수가 5의 배수 또는 3500 이상일 확률은?' }],
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
          parts: [{ type: 'text' as const, text: '전체 경우의 수는 5*4*3*2 = 120 입니다.' }],
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
          parts: [{ type: 'text' as const, text: '마지막 자리 수가 0이 될 수는 없죠... 마지막 수가 5라면 4개 중 3개를 택해서 나열하는 경우의 수와 같아요. 그러면 4*3*2=24 입니다.' }],
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
          parts: [{ type: 'text' as const, text: '일단 앞자리가 4나 5인 경우의 수는... 48? 근데 3일때는 다 되는 것이 아니잖아' }],
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
          parts: [{ type: 'text' as const, text: '그러면 3,5 다음에 두 자리만 결정하면 되니깐, 3개 중 2개 고르기. 그러면 6이고 총 54겠네.' }],
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
          parts: [{ type: 'text' as const, text: '끝자리가 5, 앞쪽이 4나 5여야겠네. 근데 5가 하나니깐 앞 쪽이 4. 그러니깐 6개.' }],
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
          parts: [{ type: 'text' as const, text: '그러면 5분의 3이 답이 되겠군.' }],
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
          parts: [{type: 'text' as const, text: 'Example 2'}],
          metadata: {
            createdAt: new Date().toISOString(),
          },
        }
      ];
    }

    const fewShotExamples = createFewShotExamples();
    const uiMessages = [
      ...convertToUIMessages(messagesFromDb),
      ...fewShotExamples,
      message,
    ];

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
