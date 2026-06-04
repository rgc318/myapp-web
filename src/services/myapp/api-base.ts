export function getMyAppApiBaseUrl() {
  return (__MYAPP_WEB_API_BASE_URL__ || '').replace(/\/+$/, '');
}

export function buildMyAppApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getMyAppApiBaseUrl();
  return `${baseUrl}${normalizedPath}`;
}
