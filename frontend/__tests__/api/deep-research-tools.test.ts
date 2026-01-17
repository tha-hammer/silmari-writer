import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock response data for Deep Research API with tool outputs
const mockDeepResearchResponseWithWebSearch = {
  id: 'resp_123456',
  object: 'response',
  status: 'completed',
  output: [
    {
      id: 'ws_001',
      type: 'web_search_call',
      status: 'completed',
      query: 'AI safety research papers 2024',
    },
    {
      id: 'ws_002',
      type: 'web_search_call',
      status: 'completed',
      query: 'machine learning safety frameworks',
    },
    {
      id: 'reasoning_001',
      type: 'reasoning',
      summary: [{ type: 'summary_text', text: 'Analyzed web search results from multiple sources.' }],
    },
    {
      id: 'msg_001',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'output_text',
        text: 'Based on my research, AI safety is a growing field...',
        annotations: [{
          type: 'url_citation',
          url: 'https://example.com/ai-safety',
          title: 'AI Safety Research',
          start_index: 0,
          end_index: 50,
        }],
      }],
    },
  ],
  usage: {
    input_tokens: 100,
    output_tokens: 500,
    reasoning_tokens: 200,
  },
};

const mockDeepResearchResponseWithCodeInterpreter = {
  id: 'resp_789012',
  object: 'response',
  status: 'completed',
  output: [
    {
      id: 'ci_001',
      type: 'code_interpreter_call',
      status: 'completed',
      code: 'import pandas as pd\ndf = pd.read_csv("data.csv")\ndf.describe()',
      output: 'count    100.0\nmean      45.2',
    },
    {
      id: 'ci_002',
      type: 'code_interpreter_call',
      status: 'completed',
      code: 'df.plot()',
      output: '<matplotlib figure>',
    },
    {
      id: 'msg_001',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'output_text',
        text: 'I analyzed the data and found...',
      }],
    },
  ],
  usage: {
    input_tokens: 150,
    output_tokens: 300,
  },
};

const mockDeepResearchResponse = {
  id: 'resp_basic',
  object: 'response',
  status: 'completed',
  output: [{
    id: 'msg_001',
    type: 'message',
    role: 'assistant',
    content: [{
      type: 'output_text',
      text: 'This is a research report.',
    }],
  }],
  usage: {
    input_tokens: 100,
    output_tokens: 200,
  },
};

// Background job response - used in tests that verify background mode behavior
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _mockBackgroundJobResponse = {
  id: 'job_abc123',
  object: 'response',
  status: 'pending',
};

// Mock fetch for OpenAI API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('/api/tools/deep-research - Phase 2: Tool Configuration', () => {
  const originalEnv = process.env;
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key-123' };

    // Reset fetch mock
    mockFetch.mockReset();

    // Dynamically import after mocks are set up
    const module = await import('@/app/api/tools/deep-research/route');
    POST = module.POST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // REQ_001.1: web_search_preview tool configuration
  describe('REQ_001.1: web_search_preview tool configuration', () => {
    it('should accept web_search_preview tool with type only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{ type: 'web_search_preview' }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools).toContainEqual({ type: 'web_search_preview' });
    });

    it('should include domains.include whitelist in request payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{
            type: 'web_search_preview',
            domains: { include: ['arxiv.org', 'nature.com'] },
          }],
        }),
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools[0].domains.include).toEqual(['arxiv.org', 'nature.com']);
    });

    it('should include domains.exclude blacklist in request payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{
            type: 'web_search_preview',
            domains: { exclude: ['spam-site.com', 'low-quality.net'] },
          }],
        }),
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools[0].domains.exclude).toEqual(['spam-site.com', 'low-quality.net']);
    });

    it('should validate domain format and reject invalid domains', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI',
          tools: [{
            type: 'web_search_preview',
            domains: { include: ['not a valid domain'] },
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Invalid domain format');
    });

    it('should accept valid domain formats like example.com and sub.example.com', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{
            type: 'web_search_preview',
            domains: { include: ['example.com', 'sub.example.org', 'deep.sub.domain.co.uk'] },
          }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should include search_context_size in request payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{
            type: 'web_search_preview',
            search_context_size: 'high',
          }],
        }),
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools[0].search_context_size).toBe('high');
    });

    it('should validate search_context_size enum values', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI',
          tools: [{
            type: 'web_search_preview',
            search_context_size: 'invalid_size',
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('search_context_size');
    });

    it('should accept all valid search_context_size values: low, medium, high', async () => {
      for (const size of ['low', 'medium', 'high']) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeepResearchResponse,
        });

        const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
          method: 'POST',
          body: JSON.stringify({
            query: 'Research AI',
            tools: [{
              type: 'web_search_preview',
              search_context_size: size,
            }],
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it('should include user_location in request payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{
            type: 'web_search_preview',
            user_location: { country: 'US', city: 'San Francisco', region: 'California' },
          }],
        }),
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools[0].user_location).toEqual({
        country: 'US',
        city: 'San Francisco',
        region: 'California',
      });
    });

    it('should validate country code as ISO 3166-1 alpha-2', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI',
          tools: [{
            type: 'web_search_preview',
            user_location: { country: 'INVALID' },
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('ISO 3166-1 alpha-2');
    });

    it('should accept valid ISO 3166-1 alpha-2 country codes', async () => {
      for (const country of ['US', 'GB', 'DE', 'JP', 'AU']) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeepResearchResponse,
        });

        const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
          method: 'POST',
          body: JSON.stringify({
            query: 'Research AI',
            tools: [{
              type: 'web_search_preview',
              user_location: { country },
            }],
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it('should require country field in user_location', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI',
          tools: [{
            type: 'web_search_preview',
            user_location: { city: 'San Francisco' },
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('country');
    });
  });

  // REQ_001.2: code_interpreter tool support
  describe('REQ_001.2: code_interpreter tool support', () => {
    it('should accept code_interpreter tool configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Analyze this data',
          tools: [{ type: 'code_interpreter' }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools).toContainEqual({ type: 'code_interpreter' });
    });

    it('should track code_interpreter_call items in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponseWithCodeInterpreter,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Analyze data',
          tools: [{ type: 'code_interpreter' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.codeExecutions).toBeDefined();
      expect(Array.isArray(data.codeExecutions)).toBe(true);
      expect(data.codeExecutions.length).toBe(2);
    });

    it('should extract code and output from code_interpreter_call items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponseWithCodeInterpreter,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Analyze data',
          tools: [{ type: 'code_interpreter' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.codeExecutions[0].code).toContain('pandas');
      expect(data.codeExecutions[0].output).toBeDefined();
      expect(data.codeExecutions[0].status).toBe('completed');
    });

    it('should calculate session cost at $0.03 per session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponseWithCodeInterpreter,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Analyze data',
          tools: [{ type: 'code_interpreter' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.costBreakdown).toBeDefined();
      expect(data.costBreakdown.codeInterpreterSessions).toBe(2);
      expect(data.costBreakdown.codeInterpreterCost).toBe(0.06); // 2 sessions * $0.03
    });

    it('should not include costBreakdown when no code_interpreter sessions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research topic',
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.costBreakdown).toBeUndefined();
    });

    it('should work alongside other tools', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research and analyze data',
          tools: [
            { type: 'web_search_preview' },
            { type: 'code_interpreter' },
          ],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools).toHaveLength(2);
    });
  });

  // REQ_001.3: file_search tool with vector_store_ids
  describe('REQ_001.3: file_search tool with vector_store_ids', () => {
    it('should accept file_search tool with vector_store_ids', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Search through documents',
          tools: [{
            type: 'file_search',
            vector_store_ids: ['vs_abc123'],
          }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools[0].vector_store_ids).toEqual(['vs_abc123']);
    });

    it('should require vector_store_ids array', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Search docs',
          tools: [{
            type: 'file_search',
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('vector_store_ids');
    });

    it('should validate vector_store_id format (vs_xxxxx pattern)', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Search docs',
          tools: [{
            type: 'file_search',
            vector_store_ids: ['invalid_format'],
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('vector_store_id format');
    });

    it('should accept valid vector_store_id formats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Search docs',
          tools: [{
            type: 'file_search',
            vector_store_ids: ['vs_abc123', 'vs_xyz789def'],
          }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should enforce maximum of 2 vector_store_ids', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Search docs',
          tools: [{
            type: 'file_search',
            vector_store_ids: ['vs_abc123', 'vs_def456', 'vs_ghi789'],
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('maximum of 2');
    });

    it('should require at least one vector_store_id', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Search docs',
          tools: [{
            type: 'file_search',
            vector_store_ids: [],
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('at least one');
    });

    it('should accept exactly 2 vector_store_ids', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Search docs',
          tools: [{
            type: 'file_search',
            vector_store_ids: ['vs_store1', 'vs_store2'],
          }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should validate each vector_store_id in the array', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Search docs',
          tools: [{
            type: 'file_search',
            vector_store_ids: ['vs_valid', 'invalid_id'],
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  // REQ_001.4: MCP tool support
  describe('REQ_001.4: MCP tool support', () => {
    it('should accept mcp tool with server_url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Use MCP tool',
          tools: [{
            type: 'mcp',
            server_url: 'https://mcp.example.com/api',
          }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools[0].server_url).toBe('https://mcp.example.com/api');
    });

    it('should require HTTPS protocol for server_url', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Use MCP tool',
          tools: [{
            type: 'mcp',
            server_url: 'http://insecure.example.com/api',
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('HTTPS');
    });

    it('should validate URL format', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Use MCP tool',
          tools: [{
            type: 'mcp',
            server_url: 'not a valid url',
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('URL');
    });

    it('should require server_url field', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Use MCP tool',
          tools: [{
            type: 'mcp',
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('server_url');
    });

    it('should accept require_approval boolean', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Use MCP tool',
          tools: [{
            type: 'mcp',
            server_url: 'https://mcp.example.com/api',
            require_approval: false,
          }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools[0].require_approval).toBe(false);
    });

    it('should validate require_approval is boolean', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Use MCP tool',
          tools: [{
            type: 'mcp',
            server_url: 'https://mcp.example.com/api',
            require_approval: 'yes',
          }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('boolean');
    });

    it('should accept various valid HTTPS URLs', async () => {
      const validUrls = [
        'https://example.com',
        'https://api.example.com/v1',
        'https://mcp-server.company.io:8443/endpoint',
        'https://192.168.1.1/api',
      ];

      for (const url of validUrls) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockDeepResearchResponse,
        });

        const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
          method: 'POST',
          body: JSON.stringify({
            query: 'Use MCP tool',
            tools: [{
              type: 'mcp',
              server_url: url,
            }],
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it('should default require_approval to true when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Use MCP tool',
          tools: [{
            type: 'mcp',
            server_url: 'https://mcp.example.com/api',
          }],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      // Should not explicitly set require_approval if not provided
      expect(requestBody.tools[0].require_approval).toBeUndefined();
    });
  });

  // REQ_001.5: Intermediate reasoning transparency
  describe('REQ_001.5: Intermediate reasoning transparency', () => {
    it('should extract reasoning steps from response.output where type === reasoning', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponseWithWebSearch,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{ type: 'web_search_preview' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.reasoningSteps).toBeDefined();
      expect(Array.isArray(data.reasoningSteps)).toBe(true);
      expect(data.reasoningSteps.length).toBeGreaterThan(0);
    });

    it('should extract web_search_call items from response.output', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponseWithWebSearch,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{ type: 'web_search_preview' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.searchQueries).toBeDefined();
      expect(Array.isArray(data.searchQueries)).toBe(true);
      expect(data.searchQueries.length).toBe(2);
    });

    it('should include query and status in search query data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponseWithWebSearch,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{ type: 'web_search_preview' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.searchQueries[0].query).toBe('AI safety research papers 2024');
      expect(data.searchQueries[0].status).toBe('completed');
      expect(data.searchQueries[0].id).toBeDefined();
    });

    it('should include reasoning summary text in reasoning steps', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponseWithWebSearch,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{ type: 'web_search_preview' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.reasoningSteps[0].text).toContain('Analyzed web search results');
      expect(data.reasoningSteps[0].id).toBe('reasoning_001');
    });

    it('should not include searchQueries when no web_search_call items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research topic',
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.searchQueries).toBeUndefined();
    });

    it('should not include codeExecutions when no code_interpreter_call items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research topic',
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.codeExecutions).toBeUndefined();
    });

    it('should handle mixed output types correctly', async () => {
      const mixedResponse = {
        ...mockDeepResearchResponseWithWebSearch,
        output: [
          ...mockDeepResearchResponseWithWebSearch.output,
          {
            id: 'ci_001',
            type: 'code_interpreter_call',
            status: 'completed',
            code: 'print("hello")',
            output: 'hello',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mixedResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research and code',
          tools: [{ type: 'web_search_preview' }, { type: 'code_interpreter' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.searchQueries).toBeDefined();
      expect(data.codeExecutions).toBeDefined();
      expect(data.reasoningSteps).toBeDefined();
      expect(data.text).toBeDefined();
    });

    it('should preserve original text content alongside extracted data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponseWithWebSearch,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI safety',
          tools: [{ type: 'web_search_preview' }],
          background: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.text).toBe('Based on my research, AI safety is a growing field...');
      expect(data.citations).toBeDefined();
    });
  });

  // General tool validation tests
  describe('General tool validation', () => {
    it('should return validation error for unknown tool type', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI',
          tools: [{ type: 'unknown_tool' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Unknown tool type');
    });

    it('should require type field in each tool', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI',
          tools: [{ some_field: 'value' }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('type field');
    });

    it('should require tools to be an array', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research AI',
          tools: { type: 'web_search_preview' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('array');
    });

    it('should accept multiple tools of different types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research and analyze',
          tools: [
            { type: 'web_search_preview', search_context_size: 'high' },
            { type: 'code_interpreter' },
            { type: 'file_search', vector_store_ids: ['vs_abc123'] },
            { type: 'mcp', server_url: 'https://mcp.example.com' },
          ],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools).toHaveLength(4);
    });

    it('should work without tools (backward compatibility)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research topic',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools).toBeUndefined();
    });

    it('should not include tools in payload when empty array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeepResearchResponse,
      });

      const request = new NextRequest('http://localhost:3000/api/tools/deep-research', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Research topic',
          tools: [],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.tools).toBeUndefined();
    });
  });
});
