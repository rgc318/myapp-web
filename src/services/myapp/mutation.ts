import { message } from 'antd';
import {
  callGatewayMethod,
  createIdempotencyKey,
  type GatewayCallOptions,
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
}
