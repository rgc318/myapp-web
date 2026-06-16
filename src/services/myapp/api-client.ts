import { request } from '@umijs/max';

export type FrappeMethodResponse<T> = {
  message?: T;
};

export type GatewayEnvelope<T = unknown, M = Record<string, unknown>> = {
  code?: string;
  data?: T;
  message?: string;
  meta?: M;
  ok?: boolean;
  status?: 'success' | 'error' | string;
};

export type GatewayCallOptions = {
  idempotencyKey?: string;
  method?: 'GET' | 'POST';
  skipErrorHandler?: boolean;
};

export class MyAppApiError extends Error {
  code?: string;
  data?: unknown;
  meta?: unknown;
  status?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      data?: unknown;
      meta?: unknown;
      status?: number;
    },
  ) {
    super(message);
    this.name = 'MyAppApiError';
    this.code = options?.code;
    this.data = options?.data;
    this.meta = options?.meta;
    this.status = options?.status;
  }
}

function getFrappeErrorMessage(payload: any, fallback: string) {
  const candidates = [
    payload?.message?.message,
    payload?.message,
    payload?._server_messages,
    payload?.exception,
    payload?.exc,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallback;
}

function isGatewayEnvelope(value: unknown): value is GatewayEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as GatewayEnvelope;
  return (
    typeof candidate.ok === 'boolean' ||
    typeof candidate.code === 'string' ||
    typeof candidate.status === 'string'
  );
}

export async function callFrappeMethod<T = unknown>(
  methodPath: string,
  payload?: Record<string, unknown>,
  options?: GatewayCallOptions,
) {
  const headers: Record<string, string> = {};
  if (options?.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await request<FrappeMethodResponse<T>>(
    `/api/method/${methodPath}`,
    {
      data: payload,
      headers,
      method: options?.method ?? 'POST',
      skipErrorHandler: options?.skipErrorHandler ?? true,
    },
  );

  const payloadResponse = response as FrappeMethodResponse<T> & {
    data?: FrappeMethodResponse<T>;
  };

  const frappeMessage = payloadResponse.message ?? payloadResponse.data?.message;
  if (frappeMessage !== undefined) {
    return frappeMessage as T;
  }

  if (isGatewayEnvelope(payloadResponse.data)) {
    return payloadResponse.data as T;
  }

  if (isGatewayEnvelope(payloadResponse)) {
    return payloadResponse as T;
  }

  return payloadResponse as T;
}

export async function callGatewayMethod<
  T = unknown,
  M = Record<string, unknown>,
>(
  methodName: string,
  payload?: Record<string, unknown>,
  options?: GatewayCallOptions,
) {
  try {
    const envelope = await callFrappeMethod<GatewayEnvelope<T, M>>(
      `myapp.api.gateway.${methodName}`,
      payload,
      options,
    );

    if (!isGatewayEnvelope(envelope)) {
      return {
        data: envelope as T,
        meta: {} as M,
        raw: envelope,
      };
    }

    if (envelope?.ok === false) {
      throw new MyAppApiError(envelope.message || '请求失败，请稍后重试。', {
        code: envelope.code,
        data: envelope.data,
        meta: envelope.meta,
      });
    }

    return {
      data: envelope?.data as T,
      meta: envelope?.meta as M,
      raw: envelope,
    };
  } catch (error: any) {
    if (error instanceof MyAppApiError) {
      throw error;
    }

    const envelope = error?.response?.data?.message as
      | GatewayEnvelope<unknown>
      | undefined;
    if (envelope?.ok === false) {
      throw new MyAppApiError(envelope.message || '请求失败，请稍后重试。', {
        code: envelope.code,
        data: envelope.data,
        meta: envelope.meta,
        status: error?.response?.status,
      });
    }

    throw new MyAppApiError(
      getFrappeErrorMessage(error?.response?.data, '请求失败，请稍后重试。'),
      {
        status: error?.response?.status,
      },
    );
  }
}

export function createIdempotencyKey(prefix = 'web') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
