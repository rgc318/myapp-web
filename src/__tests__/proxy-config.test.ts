import proxy from '../../config/proxy';

describe('development media proxy configuration', () => {
  const expectedTarget =
    process.env.MYAPP_WEB_PROXY_TARGET || 'http://localhost:8080';

  it.each([
    'dev',
    'test',
    'pre',
  ] as const)('proxies private Frappe files in the %s environment', (environment) => {
    expect(proxy[environment]['/private/files/']).toEqual({
      target: expectedTarget,
      changeOrigin: true,
      ...(environment === 'dev' ? {} : { pathRewrite: { '^': '' } }),
    });
  });

  it.each([
    'dev',
    'test',
    'pre',
  ] as const)('keeps public and private file proxy targets aligned in the %s environment', (environment) => {
    expect(proxy[environment]['/private/files/'].target).toBe(
      proxy[environment]['/files/'].target,
    );
  });
});
