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
