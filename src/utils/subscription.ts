import type { XtreamAccountInfo } from '../services/xtream/xtreamService';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface SubscriptionSummary {
  daysLeft: number | null;
  totalDays: number;
  plan: string;
  expiresOn: string;
  status: 'active' | 'trial' | 'expired';
}

export function createSubscriptionSummary(
  account: XtreamAccountInfo,
  now = Date.now(),
): SubscriptionSummary {
  const dayMs = 86_400_000;
  const hasExpiration = Boolean(account.expiresAt && account.expiresAt > 0);
  const expirationMs = hasExpiration ? account.expiresAt! * 1000 : 0;
  const calculatedDaysLeft = hasExpiration
    ? Math.max(0, Math.ceil((expirationMs - now) / dayMs))
    : null;
  const hasCreatedAt = Boolean(account.createdAt && account.createdAt > 0);
  const totalDays =
    hasCreatedAt && hasExpiration
      ? Math.max(
          1,
          Math.ceil((expirationMs - account.createdAt! * 1000) / dayMs),
        )
      : Math.max(calculatedDaysLeft ?? 90, 90);
  const expired =
    account.status.includes('expire') ||
    account.status.includes('disabled') ||
    account.status.includes('banned') ||
    (hasExpiration && expirationMs <= now);
  const status: SubscriptionSummary['status'] = account.isTrial
    ? 'trial'
    : expired
    ? 'expired'
    : 'active';
  let expiresOn = '—';
  if (hasExpiration) {
    const date = new Date(expirationMs);
    expiresOn = `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(
      2,
      '0',
    )}, ${date.getFullYear()}`;
  }

  return {
    daysLeft: status === 'expired' ? 0 : calculatedDaysLeft,
    totalDays,
    plan: account.planName || 'Active subscription',
    expiresOn,
    status,
  };
}
