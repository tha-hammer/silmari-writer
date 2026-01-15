import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/generate/route';
import { NextRequest } from 'next/server';

// Mock OpenAI
const mockCreate = vi.fn().mockResolvedValue({
  choices: [{
    message: {
      content: 'Test response from assistant'
    }
  }]
});

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate
        }
      };
    }
  };
});

describe('/api/generate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: 'Test response from assistant'
        }
      }]
    });
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should generate response for voice transcription with empty history', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello, this is a transcribed voice message',
        history: [] // No previous messages
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toBe('Test response from assistant');
  });

  it('should generate response for voice transcription with conversation history', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What did I just say?',
        history: [
          { role: 'assistant', content: 'Previous assistant response' }
        ]
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toBe('Test response from assistant');
  });

  it('should return 400 for missing message', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        history: []
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid message format');
  });

  it('should return 500 when API key is not configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test message',
        history: []
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Chat service not configured');
  });
});
