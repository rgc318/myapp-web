import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  LoadingOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Space,
  Tag,
  Typography,
} from 'antd';
import React from 'react';
import type { AiChatResult, AiScenario } from '@/services/myapp/ai';
import { resolveAiFailureRecovery } from './ai-failure';

export type AiRunDisplayStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'stopped'
  | 'failed';

export type AiToolProgress = {
  name: string;
  resultCount?: number;
  status: 'running' | 'completed';
};

const STATUS_META: Record<
  AiRunDisplayStatus,
  { color: string; icon: React.ReactNode; text: string }
> = {
  completed: {
    color: 'success',
    icon: <CheckCircleOutlined />,
    text: '已完成',
  },
  failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
  idle: { color: 'default', icon: <ClockCircleOutlined />, text: '等待运行' },
  running: {
    color: 'processing',
    icon: <LoadingOutlined />,
    text: '生成中',
  },
  stopped: { color: 'warning', icon: <StopOutlined />, text: '已停止' },
};

const SCENARIO_LABELS: Record<AiScenario, string> = {
  auto: '智能模式',
  general: '通用助手',
  inventory_adjustment_draft: '库存调整草稿',
  order_query: '订单查询',
  product_search: '商品查询',
  product_setup_draft: '商品建档草稿',
  purchase_order_draft: '采购订单草稿',
  report_summary: '经营报表解释',
  sales_order_draft: '销售订单草稿',
};

function durationText(value: number | null | undefined) {
  if (value === null || value === undefined || value <= 0) return '-';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} 秒` : `${value} ms`;
}

export function AiRunInspector({
  activeRunId,
  company,
  createdAt,
  error,
  errorCode,
  onEditRequest,
  onRetry,
  result,
  scenario,
  status,
  tools,
  warnings,
}: {
  activeRunId?: string | null;
  company?: string | null;
  createdAt?: string | null;
  error?: string | null;
  errorCode?: string | null;
  onEditRequest?: () => void;
  onRetry?: () => void;
  result: AiChatResult | null;
  scenario?: AiScenario | null;
  status: AiRunDisplayStatus;
  tools: AiToolProgress[];
  warnings: string[];
}) {
  const statusMeta = STATUS_META[status];
  const run = result?.run;
  const runId = result?.runId || activeRunId || null;
  const resolvedError = run?.error || error;
  const resolvedErrorCode = run?.errorCode || errorCode;
  const failureRecovery = resolvedError
    ? resolveAiFailureRecovery(resolvedErrorCode)
    : null;

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <ProCard
        extra={
          <Tag color={statusMeta.color} icon={statusMeta.icon}>
            {statusMeta.text}
          </Tag>
        }
        title="运行概览"
        variant="outlined"
      >
        <Descriptions
          column={1}
          size="small"
          items={[
            {
              key: 'scenario',
              label: '业务场景',
              children: scenario ? SCENARIO_LABELS[scenario] : '-',
            },
            {
              key: 'company',
              label: '数据范围',
              children: company
                ? `${company} · 当前账号权限`
                : '当前账号权限范围',
            },
            {
              key: 'latency',
              label: '总耗时',
              children: durationText(run?.latencyMs),
            },
            {
              key: 'createdAt',
              label: '消息时间',
              children: createdAt || '-',
            },
            ...(resolvedError
              ? [
                  {
                    key: 'errorCategory',
                    label: '错误类别',
                    children:
                      failureRecovery?.title || resolvedErrorCode || '运行失败',
                  },
                ]
              : []),
          ]}
        />
      </ProCard>

      <Collapse
        items={[
          {
            children: (
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: 'modelAlias',
                    label: '能力模型',
                    children: result?.modelAlias || '等待首次调用',
                  },
                  {
                    key: 'model',
                    label: '实际模型',
                    children: result?.model || '-',
                  },
                  {
                    key: 'firstToken',
                    label: '首 Token',
                    children: durationText(run?.firstTokenMs),
                  },
                  {
                    key: 'stream',
                    label: '输出方式',
                    children: result
                      ? result.stream.deltaCount > 0
                        ? [
                            '流式',
                            result.stream.deltaCount,
                            '段 ·',
                            result.stream.streamedChars,
                            '字符',
                          ].join(' ')
                        : '结构化结果完成后展示'
                      : '-',
                  },
                  {
                    key: 'tokens',
                    label: 'Token',
                    children: result
                      ? `${result.usage.totalTokens}（输入 ${result.usage.promptTokens} / 输出 ${result.usage.completionTokens} / 推理 ${result.usage.reasoningTokens}）`
                      : '0',
                  },
                  {
                    key: 'run',
                    label: 'Run',
                    children: (
                      <Typography.Text copyable={Boolean(runId)} ellipsis>
                        {runId || '-'}
                      </Typography.Text>
                    ),
                  },
                  {
                    key: 'trace',
                    label: 'Trace',
                    children: (
                      <Typography.Text
                        copyable={Boolean(result?.traceId)}
                        ellipsis
                      >
                        {result?.traceId || '-'}
                      </Typography.Text>
                    ),
                  },
                ]}
              />
            ),
            key: 'advanced',
            label: '高级诊断',
          },
        ]}
        size="small"
      />

      {tools.length ? (
        <ProCard size="small" title="业务工具" variant="outlined">
          <Space orientation="vertical" size={6} style={{ width: '100%' }}>
            {tools.map((tool) => (
              <Space
                key={tool.name}
                style={{ justifyContent: 'space-between' }}
              >
                <Typography.Text>{tool.name}</Typography.Text>
                <Tag
                  color={tool.status === 'completed' ? 'success' : 'processing'}
                >
                  {tool.status === 'completed'
                    ? `完成${tool.resultCount === undefined ? '' : ` · ${tool.resultCount} 项`}`
                    : '执行中'}
                </Tag>
              </Space>
            ))}
          </Space>
        </ProCard>
      ) : null}

      {resolvedError ? (
        <Alert
          action={
            failureRecovery?.action === 'retry' && onRetry ? (
              <Button icon={<ReloadOutlined />} onClick={onRetry} size="small">
                稍后重试
              </Button>
            ) : failureRecovery?.action === 'edit' && onEditRequest ? (
              <Button
                icon={<EditOutlined />}
                onClick={onEditRequest}
                size="small"
              >
                修改问题
              </Button>
            ) : undefined
          }
          description={
            <Space orientation="vertical" size={2}>
              <Typography.Text>{resolvedError}</Typography.Text>
              <Typography.Text type="secondary">
                {failureRecovery?.description}
              </Typography.Text>
              {resolvedErrorCode ? (
                <Typography.Text code>{resolvedErrorCode}</Typography.Text>
              ) : null}
            </Space>
          }
          showIcon
          title={failureRecovery?.title}
          type={failureRecovery?.alertType}
        />
      ) : null}
      {!resolvedError && status === 'stopped' && onRetry ? (
        <Button block icon={<ReloadOutlined />} onClick={onRetry}>
          重新发送上次问题
        </Button>
      ) : null}
      {warnings.map((warning) => (
        <Alert key={warning} showIcon title={warning} type="warning" />
      ))}
    </Space>
  );
}
