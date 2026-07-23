import { resolveAiFailureRecovery } from './ai-failure';

describe('AI failure recovery', () => {
  it.each([
    ['AI_REQUEST_RATE_LIMITED', 'retryable', 'retry'],
    ['AI_REQUEST_INVALID', 'input', 'edit'],
    ['PERMISSION_DENIED', 'permission', 'none'],
    ['AI_DAILY_BUDGET_EXCEEDED', 'system', 'none'],
  ] as const)('maps %s to %s recovery', (code, kind, action) => {
    expect(resolveAiFailureRecovery(code)).toEqual(
      expect.objectContaining({ action, kind }),
    );
  });

  it('keeps legacy and unknown failures manually retryable', () => {
    expect(
      resolveAiFailureRecovery('UpstreamServiceUnavailableError').action,
    ).toBe('retry');
    expect(resolveAiFailureRecovery(null).action).toBe('retry');
  });
});
