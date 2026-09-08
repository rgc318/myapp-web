import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { getMutationErrorMessage } from '@/services/myapp/mutation';
import type { LifecyclePlan } from '@/services/myapp/product-lifecycle';
import {
  discardLifecyclePlan,
  executeLifecyclePlan,
  getLifecyclePlan,
  lifecycleOperationLabels,
  listLifecyclePlans,
  resolveLifecyclePlan,
} from '@/services/myapp/product-lifecycle';

const statusLabels: Record<string, string> = {
  pending: '待确认',
  expired: '已过期',
  completed: '已执行',
  discarded: '已放弃',
  superseded: '已生成新计划',
};

export function ProductLifecyclePlanModal({
  planId,
  onClose,
}: {
  planId: string | null;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<LifecyclePlan | null>(null);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState({
    targets: false,
    sharedScope: false,
    deletion: false,
  });
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState(0),
    [now, setNow] = useState(Date.now());
  const inFlight = useRef(false);
  const adopt = (value: LifecyclePlan) => {
    const timestamp = Date.now();
    setNow(timestamp);
    setPlan(value);
    setDeadline(timestamp + value.expiresInSeconds * 1000);
    setChecks({ targets: false, sharedScope: false, deletion: false });
    setSelections({});
  };
  useEffect(() => {
    let active = true;
    setPlan(null);
    setError(null);
    if (!planId) return;
    setLoading(true);
    getLifecyclePlan(planId)
      .then((value) => {
        if (active) adopt(value);
      })
      .catch((caught) => {
        if (active) setError(getMutationErrorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [planId]);
  useEffect(() => {
    if (!planId) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [planId]);
  const run = async (action: () => Promise<LifecyclePlan>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      adopt(await action());
    } catch (caught) {
      setError(getMutationErrorMessage(caught));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const pending = plan?.status === 'pending' && now < deadline;
  const canExecute =
    pending &&
    plan?.executionAvailable &&
    !plan.groups.length &&
    checks.targets &&
    checks.sharedScope &&
    (plan.operation !== 'delete' || checks.deletion);
  return (
    <Modal
      open={Boolean(planId)}
      title="商品生命周期操作计划"
      width={850}
      footer={null}
      onCancel={() => {
        if (!inFlight.current) onClose();
      }}
      closable={!busy}
      mask={{ closable: !busy }}
      keyboard={!busy}
    >
      <Spin spinning={loading}>
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          {error ? (
            <Alert
              type="error"
              showIcon
              title="操作未完成"
              description={
                <Typography.Text type="danger">{error}</Typography.Text>
              }
            />
          ) : null}
          {plan ? (
            <>
              <Descriptions
                size="small"
                column={2}
                items={[
                  {
                    key: 'action',
                    label: '操作',
                    children:
                      lifecycleOperationLabels[plan.operation] ??
                      plan.operation,
                  },
                  {
                    key: 'status',
                    label: '状态',
                    children:
                      plan.status === 'pending' &&
                      !plan.executionAvailable &&
                      !plan.groups.length ? (
                        <Tag color="error">预检未通过</Tag>
                      ) : (
                        (statusLabels[plan.status] ?? plan.status)
                      ),
                  },
                  {
                    key: 'source',
                    label: '原始要求',
                    children: plan.sourceContent,
                    span: 2,
                  },
                  {
                    key: 'version',
                    label: '计划版本',
                    children: `${plan.name} · v${plan.version}`,
                    span: 2,
                  },
                  { key: 'expiry', label: '有效期', children: plan.expiresAt },
                ]}
              />
              <Alert
                type={plan.operation === 'delete' ? 'warning' : 'info'}
                showIcon
                title="共享商品主档范围"
                description={plan.scopeWarning}
              />
              {plan.status === 'pending' && !pending ? (
                <Alert
                  type="warning"
                  title="计划已过期，请重新发送请求生成计划。"
                />
              ) : null}
              {plan.groups.length ? (
                <>
                  <Alert
                    type="warning"
                    title="请逐项确认目标，系统不会自动选取第一项或只处理部分目标。"
                  />
                  {plan.groups.map((group) => (
                    <div key={group.id}>
                      <Typography.Text strong>
                        {group.role === 'preserve' ? '保留' : '操作'}：
                        {group.query}
                      </Typography.Text>
                      <div>
                        <Typography.Text type="secondary">
                          原文：{group.evidence}
                        </Typography.Text>
                      </div>
                      <Select
                        aria-label={`${group.role}-${group.id}`}
                        style={{ width: '100%' }}
                        disabled={!pending || busy}
                        placeholder={
                          group.candidates.length
                            ? '请选择明确商品编码'
                            : '无完整候选，请重新发送明确商品编码'
                        }
                        value={selections[group.id]}
                        onChange={(value) =>
                          setSelections((current) => ({
                            ...current,
                            [group.id]: value,
                          }))
                        }
                        options={group.candidates.map((item) => ({
                          value: item.itemCode,
                          label: `${item.itemName} · ${item.itemCode} · ${item.disabled ? '停用' : '启用'}`,
                        }))}
                      />
                    </div>
                  ))}
                  <Button
                    loading={busy}
                    disabled={
                      !pending ||
                      busy ||
                      plan.groups.some((group) => !selections[group.id])
                    }
                    onClick={() =>
                      void run(() => resolveLifecyclePlan(plan, selections))
                    }
                  >
                    确认目标并重新预检
                  </Button>
                </>
              ) : (
                <Table
                  pagination={false}
                  size="small"
                  rowKey="itemCode"
                  dataSource={plan.targets}
                  columns={[
                    { title: '商品编码', dataIndex: 'itemCode' },
                    { title: '商品名称', dataIndex: 'itemName' },
                    {
                      title: '预检时状态',
                      dataIndex: 'disabled',
                      render: (value) => (value ? '停用' : '启用'),
                    },
                    {
                      title: '预检结果',
                      render: (_, item) =>
                        item.blockers.length ? (
                          <Space orientation="vertical" size={4}>
                            <Tag color="error">不允许执行</Tag>
                            {item.blockers.map((issue) => (
                              <Typography.Text
                                key={issue.code}
                                type="danger"
                                strong
                              >
                                {issue.message}
                              </Typography.Text>
                            ))}
                          </Space>
                        ) : (
                          '通过'
                        ),
                    },
                  ]}
                />
              )}
              {plan.preserveTargets.length ? (
                <Alert
                  type="info"
                  title="以下商品明确保留，不执行操作"
                  description={plan.preserveTargets
                    .map((item) => `${item.itemName}（${item.itemCode}）`)
                    .join('、')}
                />
              ) : null}
              {!plan.groups.length &&
              !plan.executionAvailable &&
              plan.status === 'pending' ? (
                <Alert
                  type="error"
                  showIcon
                  title={
                    <Typography.Text type="danger" strong>
                      整批预检未通过，不会自动执行部分目标或替换动作。
                    </Typography.Text>
                  }
                />
              ) : null}
              {plan.receipt ? (
                <Alert
                  type="success"
                  title="操作已执行，以下为持久回执"
                  description={
                    <Space orientation="vertical">
                      <span>
                        {lifecycleOperationLabels[plan.receipt.operation]}：
                        {plan.receipt.itemCodes.join('、')}
                      </span>
                      <span>
                        执行人：{plan.receipt.executedBy} · 时间：
                        {plan.receipt.executedAt}
                      </span>
                      <span>请求号：{plan.receipt.requestId}</span>
                    </Space>
                  }
                />
              ) : null}
              {pending && plan.executionAvailable && !plan.groups.length ? (
                <Space orientation="vertical">
                  <Checkbox
                    disabled={busy}
                    checked={checks.targets}
                    onChange={(event) =>
                      setChecks((value) => ({
                        ...value,
                        targets: event.target.checked,
                      }))
                    }
                  >
                    我已核对全部商品编码、操作和保留对象，确认符合原始要求
                  </Checkbox>
                  <Checkbox
                    disabled={busy}
                    checked={checks.sharedScope}
                    onChange={(event) =>
                      setChecks((value) => ({
                        ...value,
                        sharedScope: event.target.checked,
                      }))
                    }
                  >
                    我确认该操作影响共享商品主档及所有使用它的公司
                  </Checkbox>
                  {plan.operation === 'delete' ? (
                    <Checkbox
                      disabled={busy}
                      checked={checks.deletion}
                      onChange={(event) =>
                        setChecks((value) => ({
                          ...value,
                          deletion: event.target.checked,
                        }))
                      }
                    >
                      我明确确认删除上述商品，了解不能通过启用按钮恢复
                    </Checkbox>
                  ) : null}
                  <Button
                    danger={plan.operation === 'delete'}
                    type="primary"
                    disabled={!canExecute || busy}
                    loading={busy}
                    onClick={() =>
                      void run(() => executeLifecyclePlan(plan, checks))
                    }
                  >
                    确认{lifecycleOperationLabels[plan.operation]}
                  </Button>
                </Space>
              ) : null}
              <Space>
                <Button
                  disabled={busy}
                  onClick={() => void run(() => getLifecyclePlan(plan.name))}
                >
                  刷新计划状态
                </Button>
                {plan.status === 'pending' ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(() => discardLifecyclePlan(plan.name))
                    }
                  >
                    放弃计划
                  </Button>
                ) : null}
                {plan.replacementPlanId ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        getLifecyclePlan(plan.replacementPlanId as string),
                      )
                    }
                  >
                    查看新计划
                  </Button>
                ) : null}
              </Space>
            </>
          ) : null}
        </Space>
      </Spin>
    </Modal>
  );
}

export function ProductLifecyclePlanCard({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Space>
        <Tag>商品操作计划</Tag>
        <Button onClick={() => setOpen(true)}>查看计划并确认</Button>
      </Space>
      <ProductLifecyclePlanModal
        planId={open ? planId : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function ProductLifecyclePlansButton() {
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LifecyclePlan[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listLifecyclePlans());
    } catch (caught) {
      setError(getMutationErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
      >
        商品操作计划
      </Button>
      <Drawer
        title="我的最近 50 条商品操作计划"
        width={700}
        open={open}
        onClose={() => setOpen(false)}
      >
        {error ? <Alert title={error} type="error" /> : null}
        <Button onClick={() => void refresh()} loading={loading}>
          刷新
        </Button>
        <Table
          loading={loading}
          dataSource={items}
          rowKey="name"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '操作',
              render: (_, plan) => lifecycleOperationLabels[plan.operation],
            },
            { title: '原始要求', dataIndex: 'sourceContent', ellipsis: true },
            {
              title: '状态',
              render: (_, plan) => statusLabels[plan.status] ?? plan.status,
            },
            {
              title: '查看',
              render: (_, plan) => (
                <Button onClick={() => setSelected(plan.name)}>查看计划</Button>
              ),
            },
          ]}
        />
      </Drawer>
      <ProductLifecyclePlanModal
        planId={selected}
        onClose={() => {
          setSelected(null);
          void refresh();
        }}
      />
    </>
  );
}
