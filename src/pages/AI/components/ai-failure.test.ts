import { resolveAiFailureRecovery } from './ai-failure';

describe('AI failure recovery', () => {
  it.each([
    ['AI_REQUEST_RATE_LIMITED', 'retryable', 'retry'],
    ['AI_REQUEST_INVALID', 'input', 'edit'],
    ['MODEL_PROVIDER_REJECTED', 'retryable', 'retry'],
    ['PERMISSION_DENIED', 'permission', 'none'],
    ['AI_DAILY_BUDGET_EXCEEDED', 'system', 'none'],
    ['AI_PROMPT_VERSION_MISMATCH', 'system', 'none'],
    ['AI_RUNTIME_CONTRACT_MISMATCH', 'system', 'none'],
    ['AI_SCHEMA_VERSION_MISMATCH', 'system', 'none'],
  ] as const)('maps %s to %s recovery', (code, kind, action) => {
    expect(resolveAiFailureRecovery(code)).toEqual(
      expect.objectContaining({ action, kind }),
    );
  });

  it('explains contract mismatch without suggesting a model retry', () => {
    expect(resolveAiFailureRecovery('AI_PROMPT_VERSION_MISMATCH')).toEqual({
      action: 'none',
      alertType: 'error',
      description:
        '当前 Backend 与 AI Orchestrator 的运行契约不一致，需要管理员同步并重新部署服务；切换模型或重复发送不会恢复。',
      kind: 'system',
      title: 'AI 运行版本需要同步',
    });
  });

  it('keeps legacy and unknown failures manually retryable', () => {
    expect(
      resolveAiFailureRecovery('UpstreamServiceUnavailableError').action,
    ).toBe('retry');
    expect(resolveAiFailureRecovery(null).action).toBe('retry');
  });
});
