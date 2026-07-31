// vier LLM service - Qwen Cloud
// Qwen-Max: complex reasoning and explanations
// Qwen-Turbo: lightweight memory maintenance

import { AnalysisResult, Strategy, AgentThought } from './types.js';
import { STRATEGY_NAMES } from './constants.js';

const QWEN_BASE_URL = (
  process.env.QWEN_BASE_URL ||
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
).replace(/\/$/, '');
const QWEN_MAX_MODEL = process.env.QWEN_MAX_MODEL || 'qwen-max';
const QWEN_TURBO_MODEL = process.env.QWEN_TURBO_MODEL || 'qwen-turbo';
const TIMEOUT_MS = Number(process.env.QWEN_TIMEOUT_MS || '30000');
const MAINTENANCE_TIMEOUT_MS = Number(process.env.QWEN_MAINTENANCE_TIMEOUT_MS || '20000');
const QWEN_MAX_TOKENS = Number(process.env.QWEN_MAX_TOKENS || '300');

const QWEN_EMBED_MODEL = process.env.QWEN_EMBED_MODEL || 'text-embedding-v2';
export const QWEN_EMBED_DIMS = 1536;

interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface QwenResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface QwenEmbedResponse {
  data?: Array<{ index: number; embedding: number[] }>;
  error?: { message?: string };
}

export class LLMService {
  private apiKey: string | null = null;
  private enabled = false;
  private callTimestamps: number[] = [];
  private readonly rateLimitWindowMs = 60000;
  private readonly maxCallsPerWindow = Number(process.env.QWEN_MAX_CALLS_PER_MINUTE || '30');

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.enabled = true;
      console.log(`Qwen LLM service initialized: ${QWEN_MAX_MODEL} / ${QWEN_TURBO_MODEL}`);
    } else {
      console.warn('No QWEN_API_KEY provided. Using template-based explanations.');
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const cutoff = now - this.rateLimitWindowMs;
    this.callTimestamps = this.callTimestamps.filter((timestamp) => timestamp > cutoff);
    return this.callTimestamps.length < this.maxCallsPerWindow;
  }

  private async callQwen(
    model: string,
    messages: QwenMessage[],
    maxTokens: number,
    timeoutMs: number,
  ): Promise<string> {
    if (!this.apiKey) {
      return '';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      const body = await response.text();
      if (!response.ok) {
        throw new Error(`Qwen API ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = JSON.parse(body || '{}') as QwenResponse;
      if (data.error) {
        throw new Error(data.error.message || 'Qwen API error');
      }
      return data.choices?.[0]?.message?.content?.trim() || '';
    } finally {
      clearTimeout(timer);
    }
  }

  async generateExplanation(analysis: AnalysisResult, memoryContext?: string): Promise<string> {
    if (!this.enabled || !this.apiKey || !this.checkRateLimit()) {
      return this.generateTemplateExplanation(analysis);
    }

    const systemParts = [
      'You are vier, an autonomous AI treasury agent managing B2B invoice yield optimization.',
      'Explain decisions in 2-3 clear sentences a small business owner can understand.',
      'Focus on the why. Be direct. No jargon without explanation.',
    ];

    if (memoryContext) {
      systemParts.push('', 'MEMORY CONTEXT (use to inform your explanation):', memoryContext);
    }

    const timestamp = Date.now();
    this.callTimestamps.push(timestamp);

    try {
      const content = await this.callQwen(
        QWEN_MAX_MODEL,
        [
          { role: 'system', content: systemParts.join('\n') },
          { role: 'user', content: this.buildPrompt(analysis) },
        ],
        QWEN_MAX_TOKENS,
        TIMEOUT_MS,
      );
      return content || this.generateTemplateExplanation(analysis);
    } catch (error) {
      const index = this.callTimestamps.lastIndexOf(timestamp);
      if (index !== -1) {
        this.callTimestamps.splice(index, 1);
      }
      console.error('Qwen explanation error, falling back to template:', error instanceof Error ? error.message : error);
      return this.generateTemplateExplanation(analysis);
    }
  }

  private buildPrompt(analysis: AnalysisResult): string {
    return `Explain this treasury decision:
- Invoice #${analysis.tokenId} | Days until due: ${analysis.daysUntilDue}
- Risk Score: ${analysis.riskScore}/100 | Payment Probability: ${analysis.paymentProbability}%
- Strategy: ${STRATEGY_NAMES[analysis.currentStrategy]} -> ${STRATEGY_NAMES[analysis.recommendedStrategy]}
- Confidence: ${analysis.confidence}% | Action: ${analysis.shouldAct ? 'EXECUTE CHANGE' : 'HOLD CURRENT'}

Strategy APY reference: Hold=0%, Conservative=3.5%, Aggressive=7%
Explain why we are ${analysis.shouldAct ? 'changing to' : 'keeping'} ${STRATEGY_NAMES[analysis.recommendedStrategy]}.`;
  }

  async condenseMemories(episodeContents: string[]): Promise<string | null> {
    if (!this.enabled || !this.apiKey || episodeContents.length === 0) {
      return null;
    }

    try {
      const content = await this.callQwen(
        QWEN_TURBO_MODEL,
        [
          {
            role: 'system',
            content: 'You are a financial memory distiller. Analyze treasury agent decision logs and extract exactly one actionable rule of thumb. Output one sentence starting with "When", "Always", or "Avoid". Be specific.',
          },
          {
            role: 'user',
            content: `Distill these ${episodeContents.length} logs into one rule:\n\n${episodeContents.map((entry, index) => `${index + 1}. ${entry}`).join('\n')}`,
          },
        ],
        100,
        MAINTENANCE_TIMEOUT_MS,
      );

      return content || null;
    } catch (error) {
      console.error('Qwen memory condensation error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async evaluateMemoryRelevance(memoryContent: string): Promise<number> {
    if (!this.enabled || !this.apiKey) {
      return 0.5;
    }

    try {
      const content = await this.callQwen(
        QWEN_TURBO_MODEL,
        [
          {
            role: 'system',
            content: 'Rate how relevant this treasury memory is for future AI decisions. Reply with only a number 0-10 (0=obsolete, 10=highly relevant).',
          },
          { role: 'user', content: `Rate (0-10): "${memoryContent}"` },
        ],
        5,
        10000,
      );

      const score = Number.parseFloat(content);
      return Number.isNaN(score) ? 0.5 : Math.min(10, Math.max(0, score)) / 10;
    } catch {
      return 0.5;
    }
  }

  async embedText(text: string): Promise<number[] | null> {
    if (!this.enabled || !this.apiKey) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${QWEN_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: QWEN_EMBED_MODEL, input: text }),
        signal: controller.signal,
      });

      const body = await response.text();
      if (!response.ok) {
        throw new Error(`Qwen embed API ${response.status}: ${body.slice(0, 120)}`);
      }

      const data = JSON.parse(body || '{}') as QwenEmbedResponse;
      if (data.error) {
        throw new Error(data.error.message || 'Qwen embedding API error');
      }
      return data.data?.[0]?.embedding ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[LLM] embedText failed, semantic fallback should be used:', message.split('\n')[0].slice(0, 80));
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private generateTemplateExplanation(analysis: AnalysisResult): string {
    const strategy = STRATEGY_NAMES[analysis.recommendedStrategy];
    const current = STRATEGY_NAMES[analysis.currentStrategy];

    if (!analysis.shouldAct) {
      return `Maintaining ${current} strategy. Conditions remain optimal with ${analysis.confidence}% confidence ` +
        `(${analysis.daysUntilDue}d until due, ${analysis.paymentProbability}% payment probability).`;
    }

    if (analysis.recommendedStrategy === Strategy.Aggressive) {
      return `Upgrading to Aggressive (7% APY). Strong fundamentals: ${analysis.riskScore}/100 risk, ` +
        `${analysis.paymentProbability}% payment probability, ${analysis.daysUntilDue}d yield window.`;
    }

    if (analysis.recommendedStrategy === Strategy.Conservative) {
      return `Moving to Conservative (3.5% APY). Moderate conditions favor stable yield over capital risk. ` +
        `${analysis.confidence}% confidence.`;
    }

    return `Switching to Hold. Risk metrics (${analysis.riskScore}/100, ${analysis.paymentProbability}% payment) ` +
      'suggest protecting capital until conditions improve.';
  }

  async generateThinkingStream(analysis: AnalysisResult): Promise<AgentThought[]> {
    const thoughts: AgentThought[] = [];
    const now = Date.now();

    thoughts.push({
      type: 'thinking',
      tokenId: analysis.tokenId,
      message: `Analyzing Invoice #${analysis.tokenId.slice(0, 8)}...`,
      timestamp: now,
      data: { step: 1, total: 4 },
    });

    thoughts.push({
      type: 'analysis',
      tokenId: analysis.tokenId,
      message: `Risk Assessment: Score ${analysis.riskScore}/100, Payment Probability ${analysis.paymentProbability}%`,
      timestamp: now + 500,
      data: {
        riskScore: analysis.riskScore,
        paymentProbability: analysis.paymentProbability,
        daysUntilDue: analysis.daysUntilDue,
      },
    });

    const strategyName = STRATEGY_NAMES[analysis.recommendedStrategy];
    thoughts.push({
      type: 'analysis',
      tokenId: analysis.tokenId,
      message: `Evaluating strategies... ${strategyName} appears optimal with ${analysis.confidence}% confidence`,
      timestamp: now + 1000,
      data: {
        currentStrategy: STRATEGY_NAMES[analysis.currentStrategy],
        recommendedStrategy: strategyName,
        confidence: analysis.confidence,
      },
    });

    thoughts.push({
      type: 'decision',
      tokenId: analysis.tokenId,
      message: await this.generateExplanation(analysis),
      timestamp: now + 1500,
      data: {
        shouldAct: analysis.shouldAct,
        strategy: analysis.recommendedStrategy,
        reasoning: analysis.reasoning,
      },
    });

    return thoughts;
  }
}