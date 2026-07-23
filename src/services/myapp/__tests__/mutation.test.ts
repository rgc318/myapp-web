import { notification } from 'antd';
import { callGatewayMethod, MyAppApiError } from '../api-client';
import { notifyMutationError, runGatewayMutation } from '../mutation';
import { getMutationErrorMessage } from '../mutation';

jest.mock('antd', () => ({
  message: { success: jest.fn() },
  notification: { error: jest.fn() },
}));

jest.mock('../api-client', () => ({
  callGatewayMethod: jest.fn(),
  createIdempotencyKey: jest.fn(() => 'test-key'),
  MyAppApiError: class MyAppApiError extends Error {
    code?: string;

    constructor(message: string, options?: { code?: string }) {
      super(message);
      this.code = options?.code;
    }
  },
}));

const mockedCallGatewayMethod = callGatewayMethod as jest.Mock;
const mockedNotificationError = notification.error as jest.Mock;

describe('mutation feedback', () => {
  beforeEach(() => {
    mockedCallGatewayMethod.mockReset();
    mockedNotificationError.mockReset();
  });

  it('shows a user-facing notification when a mutation fails', async () => {
    const error = new Error('密码不符合安全策略');
    mockedCallGatewayMethod.mockRejectedValue(error);

    await expect(runGatewayMutation('create_user_v1')).rejects.toBe(error);
    expect(mockedNotificationError).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '密码不符合安全策略',
        title: '操作未完成',
      }),
    );
  });

  it('allows callers to handle recoverable mutation errors inline', async () => {
    const error = new Error('草稿版本已变化');
    mockedCallGatewayMethod.mockRejectedValue(error);

    await expect(
      runGatewayMutation('update_ai_draft_v1', { notifyError: false }),
    ).rejects.toBe(error);
    expect(mockedNotificationError).not.toHaveBeenCalled();
  });

  it('does not display the same error object twice', () => {
    const error = new Error('重复错误');

    notifyMutationError(error);
    notifyMutationError(error);

    expect(mockedNotificationError).toHaveBeenCalledTimes(1);
  });

  it('labels draft version conflicts separately from ordinary validation errors', () => {
    notifyMutationError(
      new MyAppApiError('草稿版本已变化', {
        code: 'AI_DRAFT_VERSION_CONFLICT',
      }),
    );

    expect(mockedNotificationError).toHaveBeenCalledWith(
      expect.objectContaining({ title: '草稿版本已变化' }),
    );
  });

  it('converts Frappe password feedback HTML to readable text', () => {
    const error = new Error(
      '<div class="alert">密码强度不足</div><ul><li>请使用几个不常见的单词</li></ul>',
    );

    expect(getMutationErrorMessage(error)).toBe(
      '密码强度不足\n• 请使用几个不常见的单词',
    );
  });
});
