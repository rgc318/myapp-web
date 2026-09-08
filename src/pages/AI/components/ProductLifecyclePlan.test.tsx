import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  executeLifecyclePlan,
  getLifecyclePlan,
} from '@/services/myapp/product-lifecycle';

type LifecyclePlan = import('@/services/myapp/product-lifecycle').LifecyclePlan;

import { ProductLifecyclePlanModal } from './ProductLifecyclePlan';

jest.mock('@/services/myapp/product-lifecycle', () => ({
  getLifecyclePlan: jest.fn(),
  executeLifecyclePlan: jest.fn(),
  discardLifecyclePlan: jest.fn(),
  resolveLifecyclePlan: jest.fn(),
  listLifecyclePlans: jest.fn(),
  lifecycleOperationLabels: {
    delete: '删除商品',
    enable: '启用商品',
    disable: '停用商品',
  },
}));
jest.mock('@/services/myapp/mutation', () => ({
  getMutationErrorMessage: (error: Error) => error.message,
}));
const plan: LifecyclePlan = {
  name: 'PLAN-1',
  version: 1,
  status: 'pending',
  expiresAt: '2099-01-01',
  expiresInSeconds: 900,
  operation: 'delete',
  reason: '删除 A',
  sourceContent: '删除 A',
  scopeWarning: '影响所有公司',
  executionAvailable: true,
  targets: [
    {
      itemCode: 'A',
      itemName: '商品 A',
      modified: '',
      disabled: false,
      blockers: [],
    },
  ],
  preserveTargets: [],
  groups: [],
  replacementPlanId: null,
  receipt: null,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getLifecyclePlan).mockResolvedValue(plan);
});

it('requires all three explicit deletion confirmations and displays the persisted receipt', async () => {
  jest.mocked(executeLifecyclePlan).mockResolvedValue({
    ...plan,
    status: 'completed',
    receipt: {
      executedAt: '2026-09-07',
      executedBy: 'owner',
      requestId: 'REQ-1',
      operation: 'delete',
      itemCodes: ['A'],
    },
  });
  render(
    React.createElement(ProductLifecyclePlanModal, {
      planId: 'PLAN-1',
      onClose: jest.fn(),
    }),
  );
  const button = await screen.findByRole('button', { name: '确认删除商品' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  const checks = screen.getAllByRole('checkbox');
  fireEvent.click(checks[0]);
  fireEvent.click(checks[1]);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(executeLifecyclePlan).not.toHaveBeenCalled();
  fireEvent.click(checks[2]);
  fireEvent.click(button);
  await screen.findByText('操作已执行，以下为持久回执');
  expect(executeLifecyclePlan).toHaveBeenCalledTimes(1);
  expect(executeLifecyclePlan).toHaveBeenCalledWith(plan, {
    targets: true,
    sharedScope: true,
    deletion: true,
  });
});

it('never offers execution for a blocked plan', async () => {
  jest.mocked(getLifecyclePlan).mockResolvedValue({
    ...plan,
    executionAvailable: false,
    targets: [
      {
        ...plan.targets[0],
        blockers: [{ code: 'reference', message: '存在历史引用' }],
      },
    ],
  });
  render(
    React.createElement(ProductLifecyclePlanModal, {
      planId: 'PLAN-1',
      onClose: jest.fn(),
    }),
  );
  const reason = await screen.findByText('存在历史引用');
  expect(reason.closest('.ant-typography-danger')).not.toBeNull();
  expect(
    screen.getByText('不允许执行').closest('.ant-tag-error'),
  ).not.toBeNull();
  expect(
    screen.getByText('预检未通过').closest('.ant-tag-error'),
  ).not.toBeNull();
  const summary = screen.getByText(
    '整批预检未通过，不会自动执行部分目标或替换动作。',
  );
  expect(summary.closest('.ant-alert-error')).not.toBeNull();
  expect(summary.closest('.ant-typography-danger')).not.toBeNull();
  expect(screen.queryByRole('button', { name: '确认删除商品' })).toBeNull();
  expect(executeLifecyclePlan).not.toHaveBeenCalled();
});

it('fails closed for an expired server deadline', async () => {
  jest
    .mocked(getLifecyclePlan)
    .mockResolvedValue({ ...plan, expiresInSeconds: 0 });
  render(
    React.createElement(ProductLifecyclePlanModal, {
      planId: 'PLAN-1',
      onClose: jest.fn(),
    }),
  );
  await screen.findByText('计划已过期，请重新发送请求生成计划。');
  expect(screen.queryByRole('button', { name: '确认删除商品' })).toBeNull();
});

it('keeps a passed plan neutral and the shared scope warning distinct from errors', async () => {
  render(
    React.createElement(ProductLifecyclePlanModal, {
      planId: 'PLAN-1',
      onClose: jest.fn(),
    }),
  );
  const result = await screen.findByText('通过');
  expect(result.closest('.ant-typography-danger')).toBeNull();
  expect(screen.queryByText('预检未通过')).toBeNull();
  expect(
    screen.getByText('共享商品主档范围').closest('.ant-alert-warning'),
  ).not.toBeNull();
  expect(screen.getByText('待确认')).not.toBeNull();
});

it('highlights a permission refusal in red', async () => {
  jest
    .mocked(getLifecyclePlan)
    .mockRejectedValue(new Error('无权访问该操作计划'));
  render(
    React.createElement(ProductLifecyclePlanModal, {
      planId: 'PLAN-1',
      onClose: jest.fn(),
    }),
  );
  const reason = await screen.findByText('无权访问该操作计划');
  expect(reason.closest('.ant-typography-danger')).not.toBeNull();
  expect(reason.closest('.ant-alert-error')).not.toBeNull();
});

it('rereads server state on reopening instead of using stale confirmation state', async () => {
  const view = render(
    React.createElement(ProductLifecyclePlanModal, {
      planId: 'PLAN-1',
      onClose: jest.fn(),
    }),
  );
  await screen.findByRole('button', { name: '确认删除商品' });
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  view.rerender(
    React.createElement(ProductLifecyclePlanModal, {
      planId: null,
      onClose: jest.fn(),
    }),
  );
  view.rerender(
    React.createElement(ProductLifecyclePlanModal, {
      planId: 'PLAN-1',
      onClose: jest.fn(),
    }),
  );
  await waitFor(() => expect(getLifecyclePlan).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      (screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked,
    ).toBe(false),
  );
});
