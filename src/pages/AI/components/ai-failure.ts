export type AiFailureKind = 'retryable' | 'input' | 'permission' | 'system';

export type AiFailureRecovery = {
  action: 'retry' | 'edit' | 'none';
  alertType: 'error' | 'warning';
  description: string;
  kind: AiFailureKind;
  title: string;
};

const INPUT_CODES = new Set([
  'AI_REQUEST_INVALID',
  'VALIDATION_ERROR',
  'ValidationError',
]);

const MODEL_CODES = new Set([
  'AI_MODEL_CIRCUIT_OPEN',
  'MODEL_PROVIDER_REJECTED',
]);

const PERMISSION_CODES = new Set([
  'AUTHENTICATION_REQUIRED',
  'AuthenticationError',
  'PERMISSION_DENIED',
  'PermissionError',
]);

const SYSTEM_CODES = new Set([
  'AI_BROWSER_STREAM_UNSUPPORTED',
  'AI_DAILY_BUDGET_EXCEEDED',
  'AI_MONTHLY_BUDGET_EXCEEDED',
  'AI_PROMPT_VERSION_MISMATCH',
  'AI_RUNTIME_GOVERNANCE_UNAVAILABLE',
  'AI_SERVICE_AUTHENTICATION_FAILED',
  'INTERNAL_ERROR',
]);

export function resolveAiFailureRecovery(
  errorCode?: string | null,
): AiFailureRecovery {
  const code = errorCode?.trim() || null;
  if (code && MODEL_CODES.has(code)) {
    return {
      action: 'retry',
      alertType: 'warning',
      description:
        '本次实际使用的模型暂时不可用。可在高级设置中选择其他已验证模型，或稍后手动重试；系统不会自动重复调用。',
      kind: 'retryable',
      title: '本次模型不可用',
    };
  }
  if (code && INPUT_CODES.has(code)) {
    return {
      action: 'edit',
      alertType: 'warning',
      description:
        '请调整问题内容或业务条件后重新发送；系统不会自动重复模型调用。',
      kind: 'input',
      title: '需要修改本次问题',
    };
  }
  if (code && PERMISSION_CODES.has(code)) {
    return {
      action: 'none',
      alertType: 'warning',
      description:
        '当前账号或公司范围不允许本次操作。请检查登录状态、公司范围或联系管理员授权。',
      kind: 'permission',
      title: '当前权限不允许访问',
    };
  }
  if (code && SYSTEM_CODES.has(code)) {
    return {
      action: 'none',
      alertType: 'error',
      description:
        '该问题需要管理员处理预算、模型策略或内部服务配置；重复发送通常不会立即恢复。',
      kind: 'system',
      title: 'AI 系统或治理配置需要处理',
    };
  }
  return {
    action: 'retry',
    alertType: 'error',
    description:
      '本次问题和运行记录已保留。请稍后手动重试，系统不会自动产生新的模型调用。',
    kind: 'retryable',
    title: 'AI 服务暂时未完成请求',
  };
}
