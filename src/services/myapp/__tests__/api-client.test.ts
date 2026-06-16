import { request } from '@umijs/max';
import { callGatewayMethod } from '../api-client';

jest.mock('@umijs/max', () => ({
  request: jest.fn(),
}));

const mockedRequest = request as unknown as jest.Mock;

describe('myapp api client', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it('unwraps Frappe and gateway response envelopes', async () => {
    mockedRequest.mockResolvedValueOnce({
      message: {
        code: 'OK',
        data: { value: 1 },
        meta: { page: 1 },
        ok: true,
        status: 'success',
      },
    } as never);

    await expect(callGatewayMethod('demo_method', { q: 'x' })).resolves.toEqual({
      data: { value: 1 },
      meta: { page: 1 },
      raw: {
        code: 'OK',
        data: { value: 1 },
        meta: { page: 1 },
        ok: true,
        status: 'success',
      },
    });

    expect(mockedRequest).toHaveBeenCalledWith(
      '/api/method/myapp.api.gateway.demo_method',
      expect.objectContaining({
        data: { q: 'x' },
        method: 'POST',
        skipErrorHandler: true,
      }),
    );
  });

  it('unwraps envelopes from axios-style response data', async () => {
    mockedRequest.mockResolvedValueOnce({
      data: {
        message: {
          code: 'OK',
          data: { value: 2 },
          meta: { page: 2 },
          ok: true,
          status: 'success',
        },
      },
    } as never);

    await expect(callGatewayMethod('demo_method')).resolves.toEqual({
      data: { value: 2 },
      meta: { page: 2 },
      raw: {
        code: 'OK',
        data: { value: 2 },
        meta: { page: 2 },
        ok: true,
        status: 'success',
      },
    });
  });

  it('unwraps envelopes from full axios responses without treating HTTP status as gateway status', async () => {
    mockedRequest.mockResolvedValueOnce({
      data: {
        message: {
          code: 'OK',
          data: { order_name: 'SO-0001' },
          meta: { page: 3 },
          ok: true,
          status: 'success',
        },
      },
      headers: {},
      status: 200,
      statusText: 'OK',
    } as never);

    await expect(callGatewayMethod('demo_method')).resolves.toEqual({
      data: { order_name: 'SO-0001' },
      meta: { page: 3 },
      raw: {
        code: 'OK',
        data: { order_name: 'SO-0001' },
        meta: { page: 3 },
        ok: true,
        status: 'success',
      },
    });
  });

  it('accepts directly unwrapped gateway envelopes', async () => {
    mockedRequest.mockResolvedValueOnce({
      code: 'OK',
      data: { value: 3 },
      meta: { page: 3 },
      ok: true,
      status: 'success',
    } as never);

    await expect(callGatewayMethod('demo_method')).resolves.toEqual({
      data: { value: 3 },
      meta: { page: 3 },
      raw: {
        code: 'OK',
        data: { value: 3 },
        meta: { page: 3 },
        ok: true,
        status: 'success',
      },
    });
  });

  it('accepts directly unwrapped business data', async () => {
    mockedRequest.mockResolvedValueOnce({
      order_name: 'SO-0001',
      items: [{ item_code: 'SKU-1' }],
    } as never);

    await expect(callGatewayMethod('demo_method')).resolves.toEqual({
      data: {
        order_name: 'SO-0001',
        items: [{ item_code: 'SKU-1' }],
      },
      meta: {},
      raw: {
        order_name: 'SO-0001',
        items: [{ item_code: 'SKU-1' }],
      },
    });
  });

  it('throws MyAppApiError for gateway business errors', async () => {
    mockedRequest.mockResolvedValueOnce({
      message: {
        code: 'VALIDATION_ERROR',
        message: '参数错误',
        ok: false,
      },
    } as never);

    await expect(callGatewayMethod('demo_method')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: '参数错误',
      name: 'MyAppApiError',
    });
  });
});
