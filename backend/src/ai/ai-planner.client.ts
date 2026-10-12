import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnergyLevel } from '../database/database.types';

export interface PlanningGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  context: Record<string, unknown>;
}

export interface PlanRequest {
  minutes: number;
  energy: EnergyLevel;
  goals: PlanningGoal[];
  recent_feedback: RecentFeedback[];
}

export interface RecentFeedback {
  session_title: string | null;
  requested_minutes: number;
  energy: EnergyLevel;
  completed: boolean;
  difficulty: 'easy' | 'okay' | 'hard' | null;
  notes: string | null;
  ai_analysis: Record<string, unknown>;
  created_at: Date;
}

export interface PlannedActivity {
  goal_id: string | null;
  title: string;
  minutes: number;
  instructions: string;
}

export interface PlanResponse {
  title: string;
  activities: PlannedActivity[];
  motivation: string;
}

export interface FeedbackRequest {
  session_id: string;
  session_title: string | null;
  requested_minutes: number;
  energy: EnergyLevel;
  activities: Array<{
    title: string;
    planned_minutes: number;
    goal_id: string | null;
  }>;
  completed: boolean;
  difficulty: 'easy' | 'okay' | 'hard' | null;
  notes: string | null;
}

export interface FeedbackAnalysis {
  summary: string;
  encouragement: string;
  observations: string[];
  future_adjustments: string[];
}

@Injectable()
export class AiPlannerClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('AI_SERVICE_URL', 'http://localhost:8001')
      .replace(/\/$/, '');
    const configuredTimeout = Number(
      config.get<string>('AI_SERVICE_TIMEOUT_MS', '130000'),
    );
    this.timeoutMs = Number.isFinite(configuredTimeout)
      ? configuredTimeout
      : 130_000;
  }

  async createPlan(input: PlanRequest): Promise<PlanResponse> {
    return this.postStructured(
      '/ai/sessions/plan',
      input,
      (value): value is PlanResponse => this.isPlanResponse(value),
    );
  }

  async analyzeFeedback(input: FeedbackRequest): Promise<FeedbackAnalysis> {
    return this.postStructured(
      '/ai/sessions/analyze',
      input,
      (value): value is FeedbackAnalysis => this.isFeedbackAnalysis(value),
    );
  }

  private async postStructured<ResponseBody>(
    path: string,
    input: unknown,
    isValid: (value: unknown) => value is ResponseBody,
  ): Promise<ResponseBody> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('The AI service timed out');
      }

      throw new BadGatewayException('The AI service is unavailable');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `The AI service failed with status ${response.status}`,
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new BadGatewayException('The AI service returned invalid JSON');
    }

    if (!isValid(result)) {
      throw new BadGatewayException(
        'The AI service returned an invalid response',
      );
    }

    return result;
  }

  private isPlanResponse(value: unknown): value is PlanResponse {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      typeof value.title === 'string' &&
      value.title.length > 0 &&
      typeof value.motivation === 'string' &&
      value.motivation.length > 0 &&
      Array.isArray(value.activities) &&
      value.activities.length > 0 &&
      value.activities.every((activity) => this.isActivity(activity))
    );
  }

  private isActivity(value: unknown): value is PlannedActivity {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      (value.goal_id === null || typeof value.goal_id === 'string') &&
      typeof value.title === 'string' &&
      value.title.length > 0 &&
      Number.isInteger(value.minutes) &&
      Number(value.minutes) > 0 &&
      typeof value.instructions === 'string' &&
      value.instructions.length > 0
    );
  }

  private isFeedbackAnalysis(value: unknown): value is FeedbackAnalysis {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      typeof value.summary === 'string' &&
      value.summary.length > 0 &&
      typeof value.encouragement === 'string' &&
      value.encouragement.length > 0 &&
      this.isStringArray(value.observations) &&
      value.observations.length > 0 &&
      this.isStringArray(value.future_adjustments) &&
      value.future_adjustments.length > 0
    );
  }

  private isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string' && item.length > 0)
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
