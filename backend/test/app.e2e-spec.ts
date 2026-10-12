import {
  BadGatewayException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import {
  AiPlannerClient,
  FeedbackAnalysis,
  PlanRequest,
} from '../src/ai/ai-planner.client';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000099';

describe('OFFSCREEN API (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const feedbackAnalysis: FeedbackAnalysis = {
    summary: 'You completed a focused reading session.',
    encouragement: 'Small, consistent sessions add up.',
    observations: ['The duration matched your available energy.'],
    future_adjustments: ['Keep the next session at 20 minutes.'],
  };

  const aiPlanner = {
    createPlan: jest.fn(async (input: PlanRequest) => ({
      title: 'A focused reading break',
      motivation: 'A short session is still meaningful progress.',
      activities: [
        {
          goal_id: input.goals[0].id,
          title: 'Read your current book',
          minutes: input.minutes,
          instructions: 'Continue from your saved position.',
        },
      ],
    })),
    analyzeFeedback: jest.fn(async () => feedbackAnalysis),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiPlannerClient)
      .useValue(aiPlanner)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();

    db = app.get(DatabaseService);
    await db
      .deleteFrom('sessions')
      .where('user_id', '=', DEV_USER_ID)
      .execute();
    await db.deleteFrom('goals').where('user_id', '=', DEV_USER_ID).execute();
    await db
      .insertInto('users')
      .values({
        id: OTHER_USER_ID,
        name: 'Another User',
        email: 'other@offscreen.test',
        preferences: JSON.stringify({}),
      })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .execute();
  });

  afterAll(async () => {
    await db
      .deleteFrom('sessions')
      .where('user_id', '=', DEV_USER_ID)
      .execute();
    await db.deleteFrom('goals').where('user_id', '=', DEV_USER_ID).execute();
    await db
      .deleteFrom('sessions')
      .where('user_id', '=', OTHER_USER_ID)
      .execute();
    await db.deleteFrom('users').where('id', '=', OTHER_USER_ID).execute();
    await app.close();
  });

  it('reports database health', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
  });

  it('validates planning input before calling the AI service', async () => {
    await request(app.getHttpServer())
      .post('/sessions/plan')
      .send({ minutes: 4, energy: 'medium' })
      .expect(400);

    expect(aiPlanner.createPlan).not.toHaveBeenCalled();
  });

  it('completes the goal, planning, retrieval, and feedback journey', async () => {
    const goalResponse = await request(app.getHttpServer())
      .post('/goals')
      .send({
        title: 'Read more fiction',
        description: 'Finish the book on my nightstand.',
        category: 'reading',
      })
      .expect(201);

    const goalId = goalResponse.body.id as string;
    expect(goalResponse.body).toMatchObject({
      user_id: DEV_USER_ID,
      title: 'Read more fiction',
      status: 'active',
    });

    const sessionsBeforeFailure = await db
      .selectFrom('sessions')
      .select('id')
      .where('user_id', '=', DEV_USER_ID)
      .execute();

    aiPlanner.createPlan.mockRejectedValueOnce(
      new BadGatewayException('The AI service is unavailable'),
    );
    await request(app.getHttpServer())
      .post('/sessions/plan')
      .send({ minutes: 20, energy: 'medium' })
      .expect(502);

    const sessionsAfterFailure = await db
      .selectFrom('sessions')
      .select('id')
      .where('user_id', '=', DEV_USER_ID)
      .execute();
    expect(sessionsAfterFailure).toHaveLength(sessionsBeforeFailure.length);

    const planResponse = await request(app.getHttpServer())
      .post('/sessions/plan')
      .send({ minutes: 20, energy: 'medium' })
      .expect(201);

    const sessionId = planResponse.body.id as string;
    expect(planResponse.body).toMatchObject({
      title: 'A focused reading break',
      motivation: 'A short session is still meaningful progress.',
      requested_minutes: 20,
      energy: 'medium',
      status: 'planned',
      activities: [
        {
          goal_id: goalId,
          title: 'Read your current book',
          planned_minutes: 20,
        },
      ],
    });

    await request(app.getHttpServer())
      .get(`/sessions/${sessionId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.motivation).toBe(
          'A short session is still meaningful progress.',
        );
        expect(response.body.feedback).toBeNull();
      });

    aiPlanner.analyzeFeedback.mockRejectedValueOnce(
      new Error('AI service temporarily unavailable'),
    );
    const feedbackResponse = await request(app.getHttpServer())
      .post(`/sessions/${sessionId}/feedback`)
      .send({ completed: true, difficulty: 'okay', notes: 'Felt achievable.' })
      .expect(201);

    expect(feedbackResponse.body).toMatchObject({
      session_status: 'completed',
      analysis_status: 'pending',
      feedback: {
        completed: true,
        difficulty: 'okay',
        ai_analysis: { status: 'pending' },
      },
    });

    const retryResponse = await request(app.getHttpServer())
      .post(`/sessions/${sessionId}/feedback/analyze`)
      .expect(200);
    expect(retryResponse.body).toMatchObject({
      analysis_status: 'completed',
      feedback: { ai_analysis: feedbackAnalysis },
    });

    await request(app.getHttpServer())
      .get(`/sessions/${sessionId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('completed');
        expect(response.body.feedback.ai_analysis).toEqual(feedbackAnalysis);
      });
  });

  it("does not expose another user's session", async () => {
    const otherSession = await db
      .insertInto('sessions')
      .values({
        user_id: OTHER_USER_ID,
        title: 'Private session',
        motivation: 'Private motivation',
        requested_minutes: 10,
        energy: 'low',
        completed_at: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await request(app.getHttpServer())
      .get(`/sessions/${otherSession.id}`)
      .expect(404);
  });
});
