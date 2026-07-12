import { message, notification } from 'antd';
import {
  callGatewayMethod,
  createIdempotencyKey,
  type GatewayCallOptions,
  MyAppApiError,
} from './api-client';

export type MyAppMutationOptions<T> = {
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
  successMessage?: string;
  transform?: (data: unknown) => T;
};

export type MyAppMutationResult<T> = {
  data: T;
  idempotencyKey: string;
};

const notifiedErrors = new WeakSet<object>();

function errorTitle(error: unknown) {
  if (error instanceof MyAppApiError) {
    if (error.code === 'VALIDATION_ERROR') return '提交内容未通过校验';
    if (error.code === 'PERMISSION_DENIED') return '没有操作权限';
    if (error.code === 'AUTHENTICATION_REQUIRED') return '登录状态已失效';
    if (error.code === 'DUPLICATE_ENTRY') return '数据已存在';
    if (error.code === 'RESOURCE_NOT_FOUND') return '目标数据不存在';
    if (error.code === 'WORKFLOW_ACTION_INVALID') return '当前状态不允许此操作';
  }
  return '操作未完成';
}

export function getMutationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    const rawMessage = error.message.trim();
    const messageWithBreaks = rawMessage
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/(div|li|p|ul)>/gi, '\n');
    if (typeof document !== 'undefined') {
      const container = document.createElement('div');
      container.innerHTML = messageWithBreaks;
      return (container.textContent || rawMessage)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n');
    }
    return messageWithBreaks.replace(/<[^>]+>/g, '').trim();
  }
  return '请求失败，请检查输入内容或稍后重试。';
}

export function notifyMutationError(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    if (notifiedErrors.has(error)) return;
    notifiedErrors.add(error);
  }
  notification.error({
    title: errorTitle(error),
    description: getMutationErrorMessage(error),
    duration: 6,
    placement: 'topRight',
  });
}

export async function runGatewayMutation<T = unknown>(
  methodName: string,
  options: MyAppMutationOptions<T> = {},
): Promise<MyAppMutationResult<T>> {
  const idempotencyKey =
    options.idempotencyKey ?? createIdempotencyKey(`web-${methodName}`);
  const requestOptions: GatewayCallOptions = {
    idempotencyKey,
    method: 'POST',
  };
  try {
    const result = await callGatewayMethod(
      methodName,
      options.payload,
      requestOptions,
    );
    const data = options.transform
      ? options.transform(result.data)
      : (result.data as T);

    if (options.successMessage) {
      message.success(options.successMessage);
    }

    return {
      data,
      idempotencyKey,
    };
  } catch (error) {
    notifyMutationError(error);
    throw error;
  }
}
