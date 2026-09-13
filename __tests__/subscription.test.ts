import { createSubscriptionSummary } from '../src/utils/subscription';

const baseAccount = {
  status: 'active',
  isTrial: false,
  allowedOutputFormats: [],
};

describe('subscription presentation', () => {
  it('uses provider plan data and calculates the subscription window', () => {
    const now = Date.UTC(2030, 0, 1);
    const daySeconds = 24 * 60 * 60;
    const summary = createSubscriptionSummary(
      {
        ...baseAccount,
        planName: 'Family package',
        createdAt: now / 1000 - daySeconds * 10,
        expiresAt: now / 1000 + daySeconds * 20,
      },
      now,
    );

    expect(summary).toMatchObject({
      plan: 'Family package',
      daysLeft: 20,
      totalDays: 30,
      status: 'active',
    });
  });

  it('uses a neutral label when the provider returns no package name', () => {
    expect(createSubscriptionSummary(baseAccount, 0).plan).toBe(
      'Active subscription',
    );
  });

  it('recognizes trials and expired accounts without inventing a plan', () => {
    expect(
      createSubscriptionSummary(
        { ...baseAccount, isTrial: true, status: 'active' },
        0,
      ).status,
    ).toBe('trial');
    expect(
      createSubscriptionSummary({ ...baseAccount, status: 'expired' }, 0),
    ).toMatchObject({ status: 'expired', daysLeft: 0 });
  });
});
