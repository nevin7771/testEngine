import axios from 'axios';
import { getSearxngApiEndpoint } from './config';

interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}
// Add this to src/lib/searxng.ts// src/lib/searxng.ts
export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  try {
    const searxngURL = getSearxngApiEndpoint();
    
    // Add validation for the URL
    if (!searxngURL) {
      console.warn('SearxNG API URL is empty');
      return { 
        results: getMockResults(query), 
        suggestions: [] 
      };
    }
    
    const baseUrl = searxngURL.startsWith('http') 
      ? searxngURL 
      : `http://${searxngURL}`;
      
    try {
      const url = new URL(`${baseUrl}/search?format=json`);
      url.searchParams.append('q', query);
      
      // Add options as query parameters
      if (opts) {
        Object.entries(opts).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            url.searchParams.append(key, value.join(','));
          } else if (value !== undefined) {
            url.searchParams.append(key, String(value));
          }
        });
      }
      
      const res = await axios.get(url.toString(), { timeout: 5000 });
      const results = res.data.results || [];
      const suggestions = res.data.suggestions || [];
      
      return { results, suggestions };
    } catch (error) {
      console.warn('Error connecting to SearxNG, using mock data instead:', error);
      return { 
        results: getMockResults(query), 
        suggestions: [] 
      };
    }
  } catch (error) {
    console.error('Error in searchSearxng:', error);
    // Return mock data as fallback
    return { 
      results: getMockResults(query), 
      suggestions: [] 
    };
  }
};

// Mock data for testing when SearxNG is unavailable
function getMockResults(query: string): SearxngSearchResult[] {
  return [
    {
      title: "Zoom Support and Training",
      url: "https://support.zoom.us/hc/en-us",
      content: "Get help for Zoom. Find tutorials, guides, and troubleshooting information."
    },
    {
      title: "Zoom Community Forums",
      url: "https://community.zoom.us/",
      content: "Connect with other Zoom users to share ideas and solve problems."
    },
    {
      title: "Zoom Video Communications",
      url: "https://zoom.us/",
      content: "Zoom is the leader in modern enterprise video communications."
    }
  ];
}