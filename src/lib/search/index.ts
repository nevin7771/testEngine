import MetaSearchAgent from '@/lib/search/metaSearchAgent';
import prompts from '../prompts';

export const searchHandlers: Record<string, MetaSearchAgent> = {
  generalAgent: new MetaSearchAgent({
    // Prioritize Zoom sites in engines configuration
    activeEngines: [], // Empty to allow custom source handling
    queryGeneratorPrompt: prompts.generalAgentRetrieverPrompt,
    responsePrompt: prompts.generalAgentResponsePrompt,
    rerank: true,
    rerankThreshold: 0.3,
    searchWeb: true,
    summarizer: true,
    prioritySources: [
      "support.zoom.us", 
      "community.zoom.us",
      "zoom.us"
    ]
  }),
  jiraAgent: new MetaSearchAgent({
    activeEngines: [],
    queryGeneratorPrompt: prompts.jiraAgentRetrieverPrompt,
    responsePrompt: prompts.jiraAgentResponsePrompt,
    rerank: true,
    rerankThreshold: 0,
    searchWeb: true,
    summarizer: false,
    searchJira: true, // New flag for JIRA integration
  }),
  logAnalyzerAgent: new MetaSearchAgent({
    activeEngines: [],
    queryGeneratorPrompt: prompts.logAnalyzerAgentRetrieverPrompt,
    responsePrompt: prompts.logAnalyzerAgentResponsePrompt,
    rerank: true,
    rerankThreshold: 0,
    searchWeb: false,
    summarizer: false,
    logAnalysis: true, // New flag for log analysis
  }),
  // Original modes kept for backward compatibility
  webSearch: new MetaSearchAgent({
    activeEngines: [],
    queryGeneratorPrompt: prompts.webSearchRetrieverPrompt,
    responsePrompt: prompts.webSearchResponsePrompt,
    rerank: true,
    rerankThreshold: 0.3,
    searchWeb: true,
    summarizer: true,
  }),
  academicSearch: new MetaSearchAgent({
    activeEngines: ['arxiv', 'google scholar', 'pubmed'],
    queryGeneratorPrompt: prompts.academicSearchRetrieverPrompt,
    responsePrompt: prompts.academicSearchResponsePrompt,
    rerank: true,
    rerankThreshold: 0,
    searchWeb: true,
    summarizer: false,
  }),
  writingAssistant: new MetaSearchAgent({
    activeEngines: [],
    queryGeneratorPrompt: '',
    responsePrompt: prompts.writingAssistantPrompt,
    rerank: true,
    rerankThreshold: 0,
    searchWeb: false,
    summarizer: false,
  }),
  wolframAlphaSearch: new MetaSearchAgent({
    activeEngines: ['wolframalpha'],
    queryGeneratorPrompt: prompts.wolframAlphaSearchRetrieverPrompt,
    responsePrompt: prompts.wolframAlphaSearchResponsePrompt,
    rerank: false,
    rerankThreshold: 0,
    searchWeb: true,
    summarizer: false,
  }),
  youtubeSearch: new MetaSearchAgent({
    activeEngines: ['youtube'],
    queryGeneratorPrompt: prompts.youtubeSearchRetrieverPrompt,
    responsePrompt: prompts.youtubeSearchResponsePrompt,
    rerank: true,
    rerankThreshold: 0.3,
    searchWeb: true,
    summarizer: false,
  }),
  redditSearch: new MetaSearchAgent({
    activeEngines: ['reddit'],
    queryGeneratorPrompt: prompts.redditSearchRetrieverPrompt,
    responsePrompt: prompts.redditSearchResponsePrompt,
    rerank: true,
    rerankThreshold: 0.3,
    searchWeb: true,
    summarizer: false,
  }),
};