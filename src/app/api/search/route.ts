import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { ChatOpenAI } from '@langchain/openai';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { MetaSearchAgentType } from '@/lib/search/metaSearchAgent';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { searchHandlers } from '@/lib/search';
import { EventEmitter } from 'stream';
import { Document } from 'langchain/document';

interface chatModel {
  provider: string;
  name: string;
  customOpenAIKey?: string;
  customOpenAIBaseURL?: string;
}

interface embeddingModel {
  provider: string;
  name: string;
}

interface ChatRequestBody {
  responseMode: 'formal' | 'explanatory';  // Changed from optimizationMode
  focusModes: string[];  // Changed from focusMode to array
  chatModel?: chatModel;
  embeddingModel?: embeddingModel;
  query: string;
  history: Array<[string, string]>;
}

// Function to combine results from multiple agents
async function combineAgentResults(
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
  responseMode: 'formal' | 'explanatory',
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
        query, history, llm, embeddings, responseMode, []
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
    query, history, llm, embeddings, responseMode, []
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

export const POST = async (req: Request) => {
  try {
    const body: ChatRequestBody = await req.json();

    if (!body.focusModes || !body.query) {
      return Response.json(
        { message: 'Missing focus mode or query' },
        { status: 400 },
      );
    }

    body.history = body.history || [];
    body.responseMode = body.responseMode || 'formal';  // Default to formal
    body.focusModes = body.focusModes.length > 0 ? body.focusModes : ['generalAgent'];  // Default to general agent

    const history: BaseMessage[] = body.history.map((msg) => {
      return msg[0] === 'human'
        ? new HumanMessage({ content: msg[1] })
        : new AIMessage({ content: msg[1] });
    });

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    const chatModelProvider =
      body.chatModel?.provider || Object.keys(chatModelProviders)[0];
    const chatModel =
      body.chatModel?.name ||
      Object.keys(chatModelProviders[chatModelProvider])[0];

    const embeddingModelProvider =
      body.embeddingModel?.provider || Object.keys(embeddingModelProviders)[0];
    const embeddingModel =
      body.embeddingModel?.name ||
      Object.keys(embeddingModelProviders[embeddingModelProvider])[0];

    let llm: BaseChatModel | undefined;
    let embeddings: Embeddings | undefined;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        modelName: body.chatModel?.name || getCustomOpenaiModelName(),
        openAIApiKey:
          body.chatModel?.customOpenAIKey || getCustomOpenaiApiKey(),
        temperature: 0.7,
        configuration: {
          baseURL:
            body.chatModel?.customOpenAIBaseURL || getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (
      chatModelProviders[chatModelProvider] &&
      chatModelProviders[chatModelProvider][chatModel]
    ) {
      llm = chatModelProviders[chatModelProvider][chatModel]
        .model as unknown as BaseChatModel | undefined;
    }

    if (
      embeddingModelProviders[embeddingModelProvider] &&
      embeddingModelProviders[embeddingModelProvider][embeddingModel]
    ) {
      embeddings = embeddingModelProviders[embeddingModelProvider][
        embeddingModel
      ].model as Embeddings | undefined;
    }

    if (!llm || !embeddings) {
      return Response.json(
        { message: 'Invalid model selected' },
        { status: 400 },
      );
    }

    let emitter: EventEmitter;

    // If multiple agents selected, use combined approach
    if (body.focusModes.length > 1) {
      emitter = await combineAgentResults(
        body.query,
        history,
        llm,
        embeddings,
        body.responseMode,
        body.focusModes
      );
    } else {
      // Use single agent approach
      const searchHandler: MetaSearchAgentType = searchHandlers[body.focusModes[0]];

      if (!searchHandler) {
        return Response.json({ message: 'Invalid focus mode' }, { status: 400 });
      }

      emitter = await searchHandler.searchAndAnswer(
        body.query,
        history,
        llm,
        embeddings,
        body.responseMode,
        [],
      );
    }

    return new Promise(
      (
        resolve: (value: Response) => void,
        reject: (value: Response) => void,
      ) => {
        let message = '';
        let sources: any[] = [];

        emitter.on('data', (data) => {
          try {
            const parsedData = JSON.parse(data);
            if (parsedData.type === 'response') {
              message += parsedData.data;
            } else if (parsedData.type === 'sources') {
              sources = parsedData.data;
            }
          } catch (error) {
            reject(
              Response.json({ message: 'Error parsing data' }, { status: 500 }),
            );
          }
        });

        emitter.on('end', () => {
          resolve(Response.json({ message, sources }, { status: 200 }));
        });

        emitter.on('error', (error) => {
          reject(
            Response.json({ message: 'Search error', error }, { status: 500 }),
          );
        });
      },
    );
  } catch (err: any) {
    console.error(`Error in getting search results: ${err.message}`);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};