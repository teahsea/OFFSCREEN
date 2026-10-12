import { BadGatewayException } from '@nestjs/common';
import { PlanResponse } from '../ai/ai-planner.client';
import { SessionsService } from './sessions.service';

describe('SessionsService plan validation', () => {
  const service = new SessionsService({} as never, {} as never);
  const goalId = '00000000-0000-4000-8000-000000000002';

  const validPlan: PlanResponse = {
    title: 'A focused reading break',
    motivation: 'A short session is still meaningful progress.',
    activities: [
      {
        goal_id: goalId,
        title: 'Read your current book',
        minutes: 20,
        instructions: 'Continue from your saved position.',
      },
    ],
  };

  function validate(plan: PlanResponse) {
    return service['validatePlan'](plan, 20, [goalId]);
  }

  it('accepts an exact-duration plan grounded in an active goal', () => {
    expect(() => validate(validPlan)).not.toThrow();
  });

  it('rejects a plan whose activities do not fill the requested time', () => {
    const plan = {
      ...validPlan,
      activities: [{ ...validPlan.activities[0], minutes: 15 }],
    };

    expect(() => validate(plan)).toThrow(BadGatewayException);
  });

  it('rejects a plan that references an unavailable goal', () => {
    const plan = {
      ...validPlan,
      activities: [
        {
          ...validPlan.activities[0],
          goal_id: '00000000-0000-4000-8000-000000000099',
        },
      ],
    };

    expect(() => validate(plan)).toThrow(BadGatewayException);
  });
});
