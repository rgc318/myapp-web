import {
  clearMyAppTokens,
  getMyAppAuthHeaders,
  loadMyAppTokens,
  saveMyAppTokens,
} from './auth-storage';
import { buildMyAppApiUrl } from './api-base';

type FrappeMethodResponse<T> = {
  message?: T;
};

type TokenUser = {
  full_name?: string;
  roles?: string[];
  user?: string;
};

type LoginMessage = {
  ok?: boolean;
  code?: string;
  message?: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_expires_in?: number;
    user?: TokenUser;
  };
};

type MeMessage = {
  ok?: boolean;
  message?: string;
  data?: TokenUser & {
    email?: string;
  };
};

export type MyAppLoginParams = {
  password: string;
  rememberMe?: boolean;
  username: string;
};

export type MyAppCurrentUser = {
  email?: string;
  fullName: string;
  roles: string[];
  user: string;
};

class MyAppAuthError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MyAppAuthError';
    this.status = status;
  }
}

function mapCurrentUser(value: (TokenUser & { email?: string }) | undefined) {
  const user = value?.user || value?.email || '';
  return {
    email: value?.email || (user.includes('@') ? user : undefined),
    fullName: value?.full_name || user,
    roles: value?.roles ?? [],
    user,
  } satisfies MyAppCurrentUser;
}

export function mapMyAppUserToCurrentUser(
  user: MyAppCurrentUser | undefined,
  fallback?: API.CurrentUser,
) {
  if (!user) {
    return undefined;
  }

  return {
    ...fallback,
    access: user.roles.includes('System Manager') ? 'admin' : fallback?.access,
    email: user.email,
    name: user.fullName,
    roles: user.roles,
    userid: user.user,
  } satisfies API.CurrentUser;
}

function getFrappeMessage(payload: any, fallback: string) {
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

async function callAuthMethod<T>(
  methodPath: string,
  options?: {
    data?: Record<string, unknown>;
    headers?: Record<string, string>;
    method?: 'GET' | 'POST';
  },
) {
  const method = options?.method ?? 'POST';
  const response = await fetch(buildMyAppApiUrl(`/api/method/${methodPath}`), {
    body: method === 'GET' ? undefined : JSON.stringify(options?.data ?? {}),
    credentials: 'same-origin',
    headers: {
      ...(method === 'GET' ? undefined : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
    method,
  });
  const payload = (await response.json().catch(() => ({}))) as FrappeMethodResponse<T>;

  if (!response.ok) {
    throw new MyAppAuthError(
      getFrappeMessage(payload, '认证请求失败，请稍后重试。'),
      response.status,
    );
  }

  return payload;
}

export async function loginWithMyAppJwt(params: MyAppLoginParams) {
  const response = await callAuthMethod<LoginMessage>(
    'myapp.auth.token_api.login_v1',
    {
      data: {
        password: params.password,
        remember_me: params.rememberMe ? 1 : 0,
        username: params.username,
      },
    },
  );

  const data = response.message?.data;
  if (!data?.access_token || !data.refresh_token) {
    throw new Error(response.message?.message || '登录失败，请检查账号密码。');
  }

  saveMyAppTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    refreshExpiresIn: data.refresh_expires_in,
  });

  return mapCurrentUser(data.user);
}

export async function getMyAppCurrentUser() {
  if (!loadMyAppTokens().accessToken) {
    return undefined;
  }

  try {
    const response = await callAuthMethod<MeMessage>(
      'myapp.auth.token_api.me_v1',
      {
        headers: getMyAppAuthHeaders(),
        method: 'GET',
      },
    );

    if (response.message?.ok === false) {
      return undefined;
    }

    return mapCurrentUser(response.message?.data);
  } catch (error) {
    if (!(error instanceof MyAppAuthError) || error.status !== 401) {
      throw error;
    }
  }

  const refreshed = await refreshMyAppJwt();
  if (!refreshed) {
    return undefined;
  }

  const response = await callAuthMethod<MeMessage>(
    'myapp.auth.token_api.me_v1',
    {
      headers: getMyAppAuthHeaders(),
      method: 'GET',
    },
  );

  return response.message?.ok === false
    ? undefined
    : mapCurrentUser(response.message?.data);
}

export async function refreshMyAppJwt() {
  const { refreshToken } = loadMyAppTokens();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await callAuthMethod<LoginMessage>(
      'myapp.auth.token_api.refresh_v1',
      {
        data: {
          refresh_token: refreshToken,
        },
      },
    );

    const data = response.message?.data;
    if (!data?.access_token || !data.refresh_token) {
      clearMyAppTokens();
      return false;
    }

    saveMyAppTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      refreshExpiresIn: data.refresh_expires_in,
    });

    return true;
  } catch {
    clearMyAppTokens();
    return false;
  }
}

export async function logoutMyAppJwt() {
  const { refreshToken } = loadMyAppTokens();

  try {
    await callAuthMethod('myapp.auth.token_api.logout_v1', {
      data: refreshToken ? { refresh_token: refreshToken } : undefined,
      headers: getMyAppAuthHeaders(),
    });
  } finally {
    clearMyAppTokens();
  }
}
