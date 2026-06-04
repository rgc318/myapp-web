const ACCESS_TOKEN_KEY = 'myapp-web.access-token';
const REFRESH_TOKEN_KEY = 'myapp-web.refresh-token';
const ACCESS_EXPIRES_AT_KEY = 'myapp-web.access-expires-at';
const REFRESH_EXPIRES_AT_KEY = 'myapp-web.refresh-expires-at';

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function getStoredValue(key: string) {
  if (!canUseStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(key);
  return value?.trim() || null;
}

function setStoredValue(key: string, value: string | null) {
  if (!canUseStorage()) {
    return;
  }

  if (value?.trim()) {
    window.localStorage.setItem(key, value.trim());
  } else {
    window.localStorage.removeItem(key);
  }
}

function getStoredTimestamp(key: string) {
  const value = Number(getStoredValue(key));
  return Number.isFinite(value) ? value : null;
}

export type MyAppStoredTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  accessExpiresAt: number | null;
  refreshExpiresAt: number | null;
};

export function loadMyAppTokens(): MyAppStoredTokens {
  return {
    accessToken: getStoredValue(ACCESS_TOKEN_KEY),
    refreshToken: getStoredValue(REFRESH_TOKEN_KEY),
    accessExpiresAt: getStoredTimestamp(ACCESS_EXPIRES_AT_KEY),
    refreshExpiresAt: getStoredTimestamp(REFRESH_EXPIRES_AT_KEY),
  };
}

export function saveMyAppTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number | null;
  refreshExpiresIn?: number | null;
}) {
  const now = Date.now();

  setStoredValue(ACCESS_TOKEN_KEY, tokens.accessToken);
  setStoredValue(REFRESH_TOKEN_KEY, tokens.refreshToken);
  setStoredValue(
    ACCESS_EXPIRES_AT_KEY,
    tokens.expiresIn ? String(now + tokens.expiresIn * 1000) : null,
  );
  setStoredValue(
    REFRESH_EXPIRES_AT_KEY,
    tokens.refreshExpiresIn ? String(now + tokens.refreshExpiresIn * 1000) : null,
  );
}

export function clearMyAppTokens() {
  setStoredValue(ACCESS_TOKEN_KEY, null);
  setStoredValue(REFRESH_TOKEN_KEY, null);
  setStoredValue(ACCESS_EXPIRES_AT_KEY, null);
  setStoredValue(REFRESH_EXPIRES_AT_KEY, null);
}

export function getMyAppAccessToken() {
  return getStoredValue(ACCESS_TOKEN_KEY);
}

export function getMyAppAuthHeaders(): Record<string, string> | undefined {
  const accessToken = getMyAppAccessToken();
  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : undefined;
}
