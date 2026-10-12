import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AiPlannerClient } from '../ai/ai-planner.client';
import { DatabaseService } from '../database/database.service';
import { ListSessionsDto } from './dto/list-sessions.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly aiPlanner: AiPlannerClient,
  ) {}

  async plan(userId: string, input: CreateSessionDto) {
    const goals = await this.db
      .selectFrom('goals')
      .select(['id', 'title', 'description', 'category', 'context'])
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .orderBy('created_at', 'desc')
      .execute();

    if (goals.length === 0) {
      throw new ConflictException(
        'Create at least one active goal before planning a session',
      );
    }

    const recentFeedback = await this.db
      .selectFrom('session_feedback')
      .innerJoin('sessions', 'sessions.id', 'session_feedback.session_id')
      .select([
        'sessions.title as session_title',
        'sessions.requested_minutes',
        'sessions.energy',
        'session_feedback.completed',
        'session_feedback.difficulty',
        'session_feedback.notes',
        'session_feedback.ai_analysis',
        'session_feedback.created_at',
      ])
      .where('sessions.user_id', '=', userId)
      .orderBy('session_feedback.created_at', 'desc')
      .limit(5)
      .execute();

    const plan = await this.aiPlanner.createPlan({
      minutes: input.minutes,
      energy: input.energy,
      goals,
      recent_feedback: recentFeedback,
    });
    this.validatePlan(
      plan,
      input.minutes,
      goals.map((goal) => goal.id),
    );

    return this.db.transaction().execute(async (transaction) => {
      const session = await transaction
        .insertInto('sessions')
        .values({
          user_id: userId,
          title: plan.title,
          requested_minutes: input.minutes,
          energy: input.energy,
          completed_at: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const activities = await transaction
        .insertInto('session_activities')
        .values(
          plan.activities.map((activity, index) => ({
            session_id: session.id,
            goal_id: activity.goal_id,
            title: activity.title,
            instructions: activity.instructions,
            planned_minutes: activity.minutes,
            sort_order: index,
          })),
        )
        .returningAll()
        .execute();

      return {
        ...session,
        activities,
        motivation: plan.motivation,
      };
    });
  }

  async submitFeedback(
    userId: string,
    sessionId: string,
    input: CreateFeedbackDto,
  ) {
    const session = await this.db
      .selectFrom('sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const existingFeedback = await this.db
      .selectFrom('session_feedback')
      .select('id')
      .where('session_id', '=', sessionId)
      .executeTakeFirst();

    if (existingFeedback) {
      throw new ConflictException('Feedback has already been submitted');
    }

    const activities = await this.db
      .selectFrom('session_activities')
      .select(['title', 'planned_minutes', 'goal_id'])
      .where('session_id', '=', sessionId)
      .orderBy('sort_order', 'asc')
      .execute();

    const sessionStatus = input.completed ? 'completed' : 'skipped';
    const feedback = await this.db
      .transaction()
      .execute(async (transaction) => {
        await transaction
          .updateTable('sessions')
          .set({
            status: sessionStatus,
            completed_at: new Date(),
          })
          .where('id', '=', sessionId)
          .executeTakeFirstOrThrow();

        return transaction
          .insertInto('session_feedback')
          .values({
            session_id: sessionId,
            completed: input.completed,
            difficulty: input.difficulty ?? null,
            notes: input.notes ?? null,
            ai_analysis: JSON.stringify({ status: 'pending' }),
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      });

    try {
      const analyzedFeedback = await this.analyzeFeedback(
        session,
        activities,
        feedback.id,
        input.completed,
        input.difficulty ?? null,
        input.notes ?? null,
      );

      return {
        session_status: sessionStatus,
        analysis_status: 'completed',
        feedback: analyzedFeedback,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Feedback ${feedback.id} saved without AI analysis: ${message}`,
      );

      return {
        session_status: sessionStatus,
        analysis_status: 'pending',
        feedback,
      };
    }
  }

  async findAll(userId: string, input: ListSessionsDto) {
    let query = this.db
      .selectFrom('sessions')
      .selectAll()
      .where('user_id', '=', userId);

    if (input.status) {
      query = query.where('status', '=', input.status);
    }

    const sessions = await query
      .orderBy('created_at', 'desc')
      .limit(input.limit)
      .execute();

    if (sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((session) => session.id);
    const [activities, feedback] = await Promise.all([
      this.db
        .selectFrom('session_activities')
        .selectAll()
        .where('session_id', 'in', sessionIds)
        .orderBy('sort_order', 'asc')
        .execute(),
      this.db
        .selectFrom('session_feedback')
        .selectAll()
        .where('session_id', 'in', sessionIds)
        .execute(),
    ]);

    return sessions.map((session) => ({
      ...session,
      activities: activities.filter(
        (activity) => activity.session_id === session.id,
      ),
      feedback: feedback.find((item) => item.session_id === session.id) ?? null,
    }));
  }

  async findOne(userId: string, sessionId: string) {
    const session = await this.db
      .selectFrom('sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const [activities, feedback] = await Promise.all([
      this.db
        .selectFrom('session_activities')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('sort_order', 'asc')
        .execute(),
      this.db
        .selectFrom('session_feedback')
        .selectAll()
        .where('session_id', '=', sessionId)
        .executeTakeFirst(),
    ]);

    return {
      ...session,
      activities,
      feedback: feedback ?? null,
    };
  }

  async retryFeedbackAnalysis(userId: string, sessionId: string) {
    const sessionDetails = await this.findOne(userId, sessionId);
    const feedback = sessionDetails.feedback;

    if (!feedback) {
      throw new NotFoundException('Session feedback not found');
    }

    if (feedback.ai_analysis.status !== 'pending') {
      return {
        analysis_status: 'completed',
        feedback,
      };
    }

    const analyzedFeedback = await this.analyzeFeedback(
      sessionDetails,
      sessionDetails.activities,
      feedback.id,
      feedback.completed,
      feedback.difficulty,
      feedback.notes,
    );

    return {
      analysis_status: 'completed',
      feedback: analyzedFeedback,
    };
  }

  private async analyzeFeedback(
    session: {
      id: string;
      title: string | null;
      requested_minutes: number;
      energy: 'low' | 'medium' | 'high';
    },
    activities: Array<{
      title: string;
      planned_minutes: number;
      goal_id: string | null;
    }>,
    feedbackId: string,
    completed: boolean,
    difficulty: 'easy' | 'okay' | 'hard' | null,
    notes: string | null,
  ) {
    const analysis = await this.aiPlanner.analyzeFeedback({
      session_id: session.id,
      session_title: session.title,
      requested_minutes: session.requested_minutes,
      energy: session.energy,
      activities: activities.map((activity) => ({
        title: activity.title,
        planned_minutes: activity.planned_minutes,
        goal_id: activity.goal_id,
      })),
      completed,
      difficulty,
      notes,
    });

    return this.db
      .updateTable('session_feedback')
      .set({ ai_analysis: JSON.stringify(analysis) })
      .where('id', '=', feedbackId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  private validatePlan(
    plan: Awaited<ReturnType<AiPlannerClient['createPlan']>>,
    requestedMinutes: number,
    goalIds: string[],
  ) {
    const plannedMinutes = plan.activities.reduce(
      (total, activity) => total + activity.minutes,
      0,
    );

    if (plannedMinutes !== requestedMinutes) {
      throw new BadGatewayException(
        'The AI plan does not match the requested duration',
      );
    }

    const allowedGoalIds = new Set(goalIds);
    const referencesUnknownGoal = plan.activities.some(
      (activity) =>
        activity.goal_id !== null && !allowedGoalIds.has(activity.goal_id),
    );

    if (referencesUnknownGoal) {
      throw new BadGatewayException(
        'The AI plan references an unavailable goal',
      );
    }
  }
}
