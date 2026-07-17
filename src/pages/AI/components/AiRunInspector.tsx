import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Space, Tag, Typography } from 'antd';
import React from 'react';
import type { AiChatResult } from '@/services/myapp/ai';

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

function durationText(value: number | null | undefined) {
  if (value === null || value === undefined || value <= 0) return '-';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} 秒` : `${value} ms`;
}

export function AiRunInspector({
  activeRunId,
  error,
  onRetry,
  result,
  status,
  tools,
  warnings,
}: {
  activeRunId?: string | null;
  error?: string | null;
  onRetry?: () => void;
  result: AiChatResult | null;
  status: AiRunDisplayStatus;
  tools: AiToolProgress[];
  warnings: string[];
}) {
  const statusMeta = STATUS_META[status];
  const run = result?.run;
  const runId = result?.runId || activeRunId || null;

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <ProCard
        extra={
          <Tag color={statusMeta.color} icon={statusMeta.icon}>
            {statusMeta.text}
          </Tag>
        }
        title="本次运行"
        variant="outlined"
      >
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
              key: 'latency',
              label: '总耗时',
              children: durationText(run?.latencyMs),
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
                <Typography.Text copyable={Boolean(result?.traceId)} ellipsis>
                  {result?.traceId || '-'}
                </Typography.Text>
              ),
            },
          ]}
        />
      </ProCard>

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

      {run?.error || error ? (
        <Alert
          action={
            onRetry ? (
              <Button icon={<ReloadOutlined />} onClick={onRetry} size="small">
                手动重试
              </Button>
            ) : undefined
          }
          description={run?.errorCode || undefined}
          showIcon
          title={run?.error || error}
          type="error"
        />
      ) : null}
      {!run?.error && !error && status === 'stopped' && onRetry ? (
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
