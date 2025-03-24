import prompts from '@/lib/prompts';
import MetaSearchAgent from '@/lib/search/metaSearchAgent';
import crypto from 'crypto';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { EventEmitter } from 'stream';
import {
  chatModelProviders,
  embeddingModelProviders,
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import db from '@/lib/db';
import { chats, messages as messagesSchema } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { getFileDetails } from '@/lib/utils/files';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { searchHandlers } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Message = {
  messageId: string;
  chatId: string;
  content: string;
};

type ChatModel = {
  provider: string;
  name: string;
};

type EmbeddingModel = {
  provider: string;
  name: string;
};

type Body = {
  message: Message;
  responseMode: 'formal' | 'explanatory';  // Changed from optimizationMode
  focusModes: string[];  // Changed from focusMode string to array
  history: Array<[string, string]>;
  files: Array<string>;
  chatModel: ChatModel;
  embeddingModel: EmbeddingModel;
};

// Function to combine results from multiple agents
async function combineAgentResults(
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embedding: Embeddings,
  responseMode: 'formal' | 'explanatory',
  fileIds: string[],
  agentKeys: string[]
) {
  // Create emitter for final result
  const finalEmitter = new EventEmitter();
  
  // Map of results from each agent
  const agentResults: Record<string, Document[]> = {};
  
  // Process each agent in parallel
  await Promise.all(agentKeys.map(async (key) => {
    const agent = searchHandlers[key];
    if (!agent) return;
    
    try {
      // Create a temporary emitter for this agent
      const agentEmitter = await agent.searchAndAnswer(
        message, history, llm, embedding, responseMode, fileIds
      );
      
      // Collect all sources from this agent
      const sources: Document[] = [];
      
      // Listen for sources
      agentEmitter.on('data', (data) => {
        const parsedData = JSON.parse(data);
        if (parsedData.type === 'sources') {
          sources.push(...parsedData.data);
        }
      });
      
      // Wait for this agent to finish
      await new Promise<void>((resolve) => {
        agentEmitter.on('end', () => {
          agentResults[key] = sources;
          resolve();
        });
      });
    } catch (error) {
      console.error(`Error with agent ${key}:`, error);
    }
  }));
  
  // Combine all sources across agents
  const allSources = Object.values(agentResults).flat();
  
  // Deduplicate sources by URL
  const uniqueSources = [...new Map(
    allSources.map(source => [source.metadata.url, source])
  ).values()];
  
  // Use first agent's format for the response
  const primaryAgent = searchHandlers[agentKeys[0]];
  const stream = await primaryAgent.searchAndAnswer(
    message, history, llm, embedding, responseMode, fileIds
  );
  
  // Forward events from the primary agent
  stream.on('data', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'sources') {
      // Replace sources with our combined sources
      finalEmitter.emit(
        'data',
        JSON.stringify({ type: 'sources', data: uniqueSources })
      );
    } else {
      // Forward other events as-is
      finalEmitter.emit('data', data);
    }
  });
  
  stream.on('end', () => {
    finalEmitter.emit('end');
  });
  
  stream.on('error', (error) => {
    finalEmitter.emit('error', error);
  });
  
  return finalEmitter;
}

const handleEmitterEvents = async (
  stream: EventEmitter,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  aiMessageId: string,
  chatId: string,
) => {
  let recievedMessage = '';
  let sources: any[] = [];

  stream.on('data', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'response') {
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'message',
            data: parsedData.data,
            messageId: aiMessageId,
          }) + '\n',
        ),
      );

      recievedMessage += parsedData.data;
    } else if (parsedData.type === 'sources') {
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'sources',
            data: parsedData.data,
            messageId: aiMessageId,
          }) + '\n',
        ),
      );

      sources = parsedData.data;
    }
  });
  stream.on('end', () => {
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'messageEnd',
          messageId: aiMessageId,
        }) + '\n',
      ),
    );
    writer.close();

    db.insert(messagesSchema)
      .values({
        content: recievedMessage,
        chatId: chatId,
        messageId: aiMessageId,
        role: 'assistant',
        metadata: JSON.stringify({
          createdAt: new Date(),
          ...(sources && sources.length > 0 && { sources }),
        }),
      })
      .execute();
  });
  stream.on('error', (data) => {
    const parsedData = JSON.parse(data);
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'error',
          data: parsedData.data,
        }),
      ),
    );
    writer.close();
  });
};

const handleHistorySave = async (
  message: Message,
  humanMessageId: string,
  focusModes: string[],
  files: string[],
) => {
  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, message.chatId),
  });

  if (!chat) {
    await db
    .insert(chats)
    .values({
    id: message.chatId,
    title: message.content,
    createdAt: new Date().toString(),
    focusMode: JSON.stringify(focusModes), // This is correct - keep using "focusMode" singular
    files: files.map(getFileDetails),
  })
  .execute();
  }

  const messageExists = await db.query.messages.findFirst({
    where: eq(messagesSchema.messageId, humanMessageId),
  });

  if (!messageExists) {
    await db
      .insert(messagesSchema)
      .values({
        content: message.content,
        chatId: message.chatId,
        messageId: humanMessageId,
        role: 'user',
        metadata: JSON.stringify({
          createdAt: new Date(),
        }),
      })
      .execute();
  } else {
    await db
      .delete(messagesSchema)
      .where(
        and(
          gt(messagesSchema.id, messageExists.id),
          eq(messagesSchema.chatId, message.chatId),
        ),
      )
      .execute();
  }
};

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
      );
    }

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    const chatModelProvider =
      chatModelProviders[
        body.chatModel?.provider || Object.keys(chatModelProviders)[0]
      ];
    const chatModel =
      chatModelProvider[
        body.chatModel?.name || Object.keys(chatModelProvider)[0]
      ];

    const embeddingProvider =
      embeddingModelProviders[
        body.embeddingModel?.provider || Object.keys(embeddingModelProviders)[0]
      ];
    const embeddingModel =
      embeddingProvider[
        body.embeddingModel?.name || Object.keys(embeddingProvider)[0]
      ];

    let llm: BaseChatModel | undefined;
    let embedding = embeddingModel.model;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        openAIApiKey: getCustomOpenaiApiKey(),
        modelName: getCustomOpenaiModelName(),
        temperature: 0.7,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (chatModelProvider && chatModel) {
      llm = chatModel.model;
    }

    if (!llm) {
      return Response.json({ error: 'Invalid chat model' }, { status: 400 });
    }

    if (!embedding) {
      return Response.json(
        { error: 'Invalid embedding model' },
        { status: 400 },
      );
    }

    const humanMessageId =
      message.messageId ?? crypto.randomBytes(7).toString('hex');
    const aiMessageId = crypto.randomBytes(7).toString('hex');

    const history: BaseMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return new HumanMessage({
          content: msg[1],
        });
      } else {
        return new AIMessage({
          content: msg[1],
        });
      }
    });

    // Ensure focusModes is an array and has at least one value
    const focusModes = body.focusModes || ['generalAgent'];

    let stream: EventEmitter;

    // If multiple agents selected, use combined approach
    if (focusModes.length > 1) {
      stream = await combineAgentResults(
        message.content,
        history,
        llm,
        embedding,
        body.responseMode,
        body.files,
        focusModes
      );
    } else {
      // Use single agent approach
      const handler = searchHandlers[focusModes[0]];

      if (!handler) {
        return Response.json(
          {
            message: 'Invalid focus mode',
          },
          { status: 400 },
        );
      }

      stream = await handler.searchAndAnswer(
        message.content,
        history,
        llm,
        embedding,
        body.responseMode,  // Changed from optimizationMode
        body.files,
      );
    }

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    handleEmitterEvents(stream, writer, encoder, aiMessageId, message.chatId);
    handleHistorySave(message, humanMessageId, focusModes, body.files);

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('An error ocurred while processing chat request:', err);
    return Response.json(
      { message: 'An error ocurred while processing chat request' },
      { status: 500 },
    );
  }
};