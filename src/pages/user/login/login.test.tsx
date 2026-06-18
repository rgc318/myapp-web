import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import * as React from 'react';
import {
  loginWithMyAppJwt,
  mapMyAppUserToCurrentUser,
} from '@/services/myapp/auth';
import Login from './index';

const mockSetInitialState = jest.fn();

jest.mock('@umijs/max', () => ({
  FormattedMessage: ({ defaultMessage, id }: any) => defaultMessage || id,
  getAllLocales: () => ['zh-CN', 'en-US'],
  getLocale: () => 'zh-CN',
  Helmet: ({ children }: any) => children,
  SelectLang: () => null,
  setLocale: jest.fn(),
  useIntl: () => ({
    formatMessage: ({ defaultMessage, id }: any) => defaultMessage || id,
  }),
  useModel: () => ({
    initialState: {
      currentUser: undefined,
      fetchUserInfo: jest.fn(),
    },
    setInitialState: mockSetInitialState,
  }),
}));

jest.mock('@/services/ant-design-pro/api', () => ({
  login: jest.fn(),
}));

jest.mock('@/services/ant-design-pro/login', () => ({
  getFakeCaptcha: jest.fn(),
}));

jest.mock('@/services/myapp/auth', () => ({
  loginWithMyAppJwt: jest.fn(),
  mapMyAppUserToCurrentUser: jest.fn((user) => ({
    name: user.fullName,
    roles: user.roles,
    userid: user.user,
  })),
}));

function renderLogin() {
  return render(React.createElement(App, null, React.createElement(Login)));
}

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    window.history.pushState({}, '', '/user/login?redirect=/sales/orders');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders account login form', async () => {
    renderLogin();

    expect(await screen.findByText('账户密码登录')).toBeTruthy();
    expect(screen.getByPlaceholderText('用户名: admin or user')).toBeTruthy();
    expect(screen.getByPlaceholderText('密码: ant.design')).toBeTruthy();
  });

  it('logs in with myapp JWT and updates initial state', async () => {
    (loginWithMyAppJwt as jest.Mock).mockResolvedValue({
      email: 'admin@example.com',
      fullName: 'Admin User',
      roles: ['System Manager'],
      user: 'admin@example.com',
    });

    renderLogin();

    fireEvent.change(
      await screen.findByPlaceholderText('用户名: admin or user'),
      {
        target: { value: ' admin@example.com ' },
      },
    );
    fireEvent.change(screen.getByPlaceholderText('密码: ant.design'), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录|Login/i }));

    await waitFor(() => {
      expect(loginWithMyAppJwt).toHaveBeenCalledWith({
        password: 'secret',
        rememberMe: true,
        username: 'admin@example.com',
      });
    });

    expect(mockSetInitialState).toHaveBeenCalled();
    mockSetInitialState.mock.calls[0][0]({ currentUser: undefined });
    expect(mapMyAppUserToCurrentUser).toHaveBeenCalledWith(
      {
        email: 'admin@example.com',
        fullName: 'Admin User',
        roles: ['System Manager'],
        user: 'admin@example.com',
      },
      undefined,
    );
  });

  it('shows backend error message when JWT login fails', async () => {
    (loginWithMyAppJwt as jest.Mock).mockRejectedValue(
      new Error('账号或密码错误'),
    );

    renderLogin();

    fireEvent.change(
      await screen.findByPlaceholderText('用户名: admin or user'),
      {
        target: { value: 'admin@example.com' },
      },
    );
    fireEvent.change(screen.getByPlaceholderText('密码: ant.design'), {
      target: { value: 'bad-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录|Login/i }));

    expect(await screen.findByText('账号或密码错误')).toBeTruthy();
  });
});
