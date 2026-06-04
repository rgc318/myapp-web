import {
  clearMyAppTokens,
  getMyAppAuthHeaders,
  loadMyAppTokens,
  saveMyAppTokens,
} from '../auth-storage';

describe('myapp auth storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('saves, loads, and clears token values', () => {
    saveMyAppTokens({
      accessToken: 'access-token',
      expiresIn: 60,
      refreshExpiresIn: 120,
      refreshToken: 'refresh-token',
    });

    expect(loadMyAppTokens().accessToken).toBe('access-token');
    expect(loadMyAppTokens().refreshToken).toBe('refresh-token');
    expect(loadMyAppTokens().accessExpiresAt).toEqual(expect.any(Number));
    expect(getMyAppAuthHeaders()).toEqual({
      Authorization: 'Bearer access-token',
    });

    clearMyAppTokens();

    expect(loadMyAppTokens().accessToken).toBeNull();
    expect(loadMyAppTokens().refreshToken).toBeNull();
    expect(getMyAppAuthHeaders()).toBeUndefined();
  });
});
