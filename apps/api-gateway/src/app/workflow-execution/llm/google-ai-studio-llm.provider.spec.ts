/* eslint-disable @typescript-eslint/no-explicit-any */
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

import { GoogleAIStudioLlmProvider } from './google-ai-studio-llm.provider';

describe('GoogleAIStudioLlmProvider', () => {
  let provider: GoogleAIStudioLlmProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleAIStudioLlmProvider('test-api-key', 'gemini-1.5-pro');
  });

  function mockSuccessResponse(
    text: string,
    usage?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number },
  ) {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => text,
        usageMetadata: usage ?? {
          promptTokenCount: 100,
          candidatesTokenCount: 200,
          totalTokenCount: 300,
        },
      },
    });
  }

  // [4.2-UNIT-014] Constructs SDK model with correct params
  it('should initialize SDK with apiKey and modelId', () => {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-1.5-pro',
    });
  });

  // [4.2-UNIT-015] Successful generation returns text and token usage
  it('should return text and token usage on successful generation', async () => {
    mockSuccessResponse('Generated content', {
      promptTokenCount: 50,
      candidatesTokenCount: 120,
      totalTokenCount: 170,
    });

    const result = await provider.generate('Test prompt', {
      temperature: 0.7,
      maxOutputTokens: 4096,
    });

    expect(result.text).toBe('Generated content');
    expect(result.tokenUsage).toEqual({
      inputTokens: 50,
      outputTokens: 120,
      totalTokens: 170,
    });
  });

  // [4.2-UNIT-016] Passes generation config to SDK
  it('should pass temperature and maxOutputTokens to SDK', async () => {
    mockSuccessResponse('Response');

    await provider.generate('Prompt', {
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    expect(mockGenerateContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'Prompt' }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });
  });

  // [4.2-UNIT-017] Handles missing usageMetadata gracefully
  it('should default token counts to 0 when usageMetadata is missing', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'No metadata response',
        usageMetadata: undefined,
      },
    });

    const result = await provider.generate('Prompt', {});

    expect(result.tokenUsage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  // [4.2-UNIT-018] Retries on failure with exponential backoff
  it('should retry on failure up to 3 times', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Rate limited'))
      .mockResolvedValueOnce({
        response: {
          text: () => 'Success after retries',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        },
      });

    const result = await provider.generate('Prompt', {});

    expect(result.text).toBe('Success after retries');
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  // [4.2-UNIT-019] Throws after max retries exhausted
  it('should throw after all retry attempts are exhausted', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Persistent failure'));

    await expect(provider.generate('Prompt', {})).rejects.toThrow(
      'Persistent failure',
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  // [4.2-UNIT-020] Handles optional generation config fields
  it('should handle undefined temperature and maxOutputTokens', async () => {
    mockSuccessResponse('Response');

    await provider.generate('Prompt', {});

    expect(mockGenerateContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'Prompt' }] }],
      generationConfig: {
        temperature: undefined,
        maxOutputTokens: undefined,
      },
    });
  });
});
