import {
  DashboardOutlined,
  DislikeOutlined,
  EditOutlined,
  InfoCircleOutlined,
  LikeOutlined,
  LoadingOutlined,
  MoreOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { Actions } from '@ant-design/x';
import XMarkdown from '@ant-design/x-markdown';
import { Alert, Button, Dropdown, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import {
  type AiBusinessDocumentResult,
  type AiBusinessResultSet,
  type AiChatMessage,
  type AiCitation,
  resolveAiBusinessResultSet,
  resolveAiDraftCitation,
} from '@/services/myapp/ai';
import { useAiWorkspaceStyles } from '../styles';
import { AiDraftCompactSummary } from './AiDraftCompactSummary';
import { resolveAiFailureRecovery } from './ai-failure';
import { BusinessResultPanel } from './BusinessResultPanel';

const REPORT_METRIC_LABELS: Record<string, string> = {
  sales_amount_total: '销售额',
  purchase_amount_total: '采购额',
  received_amount_total: '实收',
  paid_amount_total: '实付',
  net_cashflow_total: '净现金流',
  receivable_outstanding_total: '应收未结',
  payable_outstanding_total: '应付未结',
};

type Props = {
  content: string;
  citations?: AiCitation[];
  error?: string | null;
  errorCode?: string | null;
  feedback?: 'positive' | 'negative';
  modelDisplay?: string | null;
  modelSelection?: 'auto' | 'fixed';
  requestedModelDisplay?: string | null;
  onDiscardDraft: (draftId: string) => void;
  onEditDraft: (citation: AiCitation) => void;
  onEditRequest?: () => void;
  onFeedback: (rating: 'positive' | 'negative') => void;
  onHandoffDraft: (draftId: string) => void;
  onOpenBusinessDocument: (document: AiBusinessDocumentResult) => void;
  onOpenDraftHistory: (draftId: string) => void;
  onOpenProduct: (citation: AiCitation) => void;
  onRefreshBusinessResult?: (resultSet: AiBusinessResultSet) => Promise<void>;
  onRetry?: () => void;
  onViewDiagnostics?: () => void;
  onViewRun?: () => void;
  progressMessage?: string;
  progressStartedAt?: number | null;
  runId?: string | null;
  streaming?: boolean;
};

function formatBusinessTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
}

function GenerationProgress({
  hasResults,
  message,
  startedAt,
}: {
  hasResults?: boolean;
  message: string;
  startedAt?: number | null;
}) {
  const { styles } = useAiWorkspaceStyles();
  const [elapsedMs, setElapsedMs] = useState(
    startedAt ? Math.max(0, Date.now() - startedAt) : 0,
  );

  useEffect(() => {
    if (!startedAt) return undefined;
    const timer = window.setInterval(
      () => setElapsedMs(Math.max(0, Date.now() - startedAt)),
      250,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div className={styles.generationStatus}>
      <span className={styles.generationIcon}>
        <LoadingOutlined spin />
      </span>
      <Space orientation="vertical" size={2}>
        <Typography.Text strong>
          {hasResults ? '业务结果已返回，正在生成摘要' : message}
        </Typography.Text>
        <Typography.Text type="secondary">
          {hasResults ? '结构化明细可立即查看' : '首个响应尚未返回'} · 已等待{' '}
          {(elapsedMs / 1000).toFixed(1)} 秒
        </Typography.Text>
      </Space>
    </div>
  );
}

function CitationCard({
  citation,
  onDiscardDraft,
  onEditDraft,
  onHandoffDraft,
  onOpenDraftHistory,
  onOpenProduct,
}: Pick<
  Props,
  | 'onDiscardDraft'
  | 'onEditDraft'
  | 'onHandoffDraft'
  | 'onOpenDraftHistory'
  | 'onOpenProduct'
> & { citation: AiCitation }) {
  const draft = resolveAiDraftCitation(citation);
  const validation = draft?.validation;
  const targetName = draft?.execution?.targetName ?? '';
  const targetDoctype = draft?.execution?.targetDoctype ?? '';
  const targetHref =
    targetDoctype === 'Sales Order'
      ? `/sales/orders/${encodeURIComponent(targetName)}`
      : targetDoctype === 'Purchase Order'
        ? `/purchase/orders/${encodeURIComponent(targetName)}`
        : targetDoctype === 'Item'
          ? `/master-data/products/${encodeURIComponent(targetName)}`
          : targetDoctype === 'Stock Entry'
            ? '/inventory/ledger'
            : null;
  return (
    <ProCard
      size="small"
      title={citation.label}
      extra={
        citation.type === 'product' ? (
          <Button
            onClick={() => onOpenProduct(citation)}
            size="small"
            type="link"
          >
            当前页查看
          </Button>
        ) : citation.href ? (
          <Button href={citation.href} size="small" type="link">
            查看详情
          </Button>
        ) : null
      }
    >
      {citation.type === 'product' ? (
        <Space orientation="vertical" size={6} style={{ width: '100%' }}>
          <Space size={[8, 4]} wrap>
            <Tag color="blue">回答时数据</Tag>
            {citation.id ? <Tag>{citation.id}</Tag> : null}
            {citation.data.specification ? (
              <Tag>{String(citation.data.specification)}</Tag>
            ) : null}
            {citation.data.match_reason ? (
              <Tag color="purple">{String(citation.data.match_reason)}</Tag>
            ) : null}
            {typeof citation.data.semantic_score === 'number' ? (
              <Tag color="geekblue">
                语义相关度{' '}
                {Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(Number(citation.data.semantic_score) * 100),
                  ),
                )}
                %
              </Tag>
            ) : null}
            <Typography.Text>
              库存 {Number(citation.data.qty ?? 0)}{' '}
              {String(citation.data.uom_display ?? citation.data.uom ?? '')}
            </Typography.Text>
            <Typography.Text>
              参考价 {Number(citation.data.price ?? 0)}
            </Typography.Text>
          </Space>
          <Typography.Text type="secondary">
            查询时间：
            {formatBusinessTime(citation.data.queried_at) ??
              '历史记录未保存查询时间'}
            {' · '}
            公司：{String(citation.data.company ?? '未记录')}
            {' · '}当前账号权限范围
          </Typography.Text>
        </Space>
      ) : citation.type === 'ai_draft' ? (
        <Space orientation="vertical" size={8}>
          <Space wrap>
            <Tag>版本 {draft?.version ?? 1}</Tag>
            <Tag
              color={
                draft?.status === 'executed'
                  ? 'success'
                  : draft?.status === 'draft'
                    ? 'blue'
                    : 'default'
              }
            >
              {draft?.status === 'executed'
                ? '已执行'
                : draft?.status === 'discarded'
                  ? '已放弃'
                  : draft?.status === 'handed_off'
                    ? '已进入业务编辑器'
                    : '待复核'}
            </Tag>
          </Space>
          {draft ? <AiDraftCompactSummary draft={draft} /> : null}
          <Typography.Text>
            {draft?.status === 'executed'
              ? `已创建正式业务对象 ${targetName || '-'}。`
              : validation?.readyForHandoff
                ? draft?.draftType === 'inventory_adjustment'
                  ? '草稿已通过实时库存校验，可由当前用户确认执行。'
                  : '草稿已通过后端校验，可由当前用户确认执行。'
                : '草稿仍有业务对象、商品、数量、单位、仓库或原因需要人工确认。'}
          </Typography.Text>
          {draft?.modified ? (
            <Typography.Text type="secondary">
              最近校验：{formatBusinessTime(draft.modified)}
            </Typography.Text>
          ) : null}
          {validation?.errors.map((error) => (
            <Typography.Text key={error} type="danger">
              {error}
            </Typography.Text>
          ))}
          <Space wrap>
            {draft?.status === 'draft' ? (
              <Button onClick={() => onEditDraft(citation)} type="primary">
                {validation?.readyForHandoff ? '复核并执行' : '完善草稿'}
              </Button>
            ) : null}
            {targetHref && targetName ? (
              <Button href={targetHref}>查看正式业务对象</Button>
            ) : null}
            <Dropdown
              menu={{
                items: [
                  { key: 'history', label: '版本历史' },
                  ...(draft?.status === 'draft' && validation?.readyForHandoff
                    ? [{ key: 'handoff', label: '在业务编辑器继续' }]
                    : []),
                  ...(draft?.status === 'draft'
                    ? [{ danger: true, key: 'discard', label: '放弃草稿' }]
                    : []),
                ],
                onClick: ({ key }) => {
                  const draftId = String(citation.id ?? '');
                  if (key === 'history') onOpenDraftHistory(draftId);
                  if (key === 'handoff') onHandoffDraft(draftId);
                  if (key === 'discard') onDiscardDraft(draftId);
                },
              }}
            >
              <Button icon={<MoreOutlined />}>更多</Button>
            </Dropdown>
          </Space>
        </Space>
      ) : citation.type === 'business_report' ? (
        <Space size={[8, 4]} wrap>
          {Object.entries(
            (citation.data.overview as Record<string, unknown>) ?? {},
          ).map(([key, value]) => (
            <Tag key={key}>
              {REPORT_METRIC_LABELS[key] ?? key}:{' '}
              {Number(value ?? 0).toLocaleString('zh-CN')}
            </Tag>
          ))}
        </Space>
      ) : (
        <Space size={[8, 4]} wrap>
          {citation.id ? <Tag>{citation.id}</Tag> : null}
          {citation.data.document_status ? (
            <Tag>{String(citation.data.document_status)}</Tag>
          ) : null}
          <Typography.Text>{String(citation.data.party ?? '')}</Typography.Text>
          <Typography.Text>
            日期 {String(citation.data.transaction_date ?? '-')}
          </Typography.Text>
          <Typography.Text>
            金额 {Number(citation.data.amount ?? 0)}
          </Typography.Text>
          <Typography.Text>
            未结 {Number(citation.data.outstanding_amount ?? 0)}
          </Typography.Text>
        </Space>
      )}
    </ProCard>
  );
}

export function AiMessageContent({
  content,
  citations = [],
  error,
  errorCode,
  feedback,
  modelDisplay,
  modelSelection = 'auto',
  requestedModelDisplay,
  onDiscardDraft,
  onEditDraft,
  onEditRequest,
  onFeedback,
  onHandoffDraft,
  onOpenBusinessDocument,
  onOpenDraftHistory,
  onOpenProduct,
  onRefreshBusinessResult,
  onRetry,
  onViewDiagnostics,
  onViewRun,
  progressMessage,
  progressStartedAt,
  runId,
  streaming,
}: Props) {
  const { styles } = useAiWorkspaceStyles();
  const businessResultSet = resolveAiBusinessResultSet(citations);
  const detailCitations = citations.filter(
    (citation) =>
      citation.type !== 'business_result_set' &&
      ![
        'sales_order',
        'sales_invoice',
        'purchase_order',
        'purchase_invoice',
      ].includes(citation.type),
  );
  const failureRecovery = error ? resolveAiFailureRecovery(errorCode) : null;

  return (
    <div className={styles.messageBody}>
      {businessResultSet ? (
        <BusinessResultPanel
          onOpenDocument={onOpenBusinessDocument}
          onRefresh={
            onRefreshBusinessResult
              ? () => onRefreshBusinessResult(businessResultSet)
              : undefined
          }
          resultSet={businessResultSet}
        />
      ) : null}
      {!content && streaming ? (
        <GenerationProgress
          hasResults={Boolean(businessResultSet)}
          message={progressMessage || '正在准备回答'}
          startedAt={progressStartedAt}
        />
      ) : (
        <div className={businessResultSet ? styles.answerSummary : undefined}>
          {businessResultSet && content ? (
            <Typography.Text strong>AI 摘要</Typography.Text>
          ) : null}
          <XMarkdown
            className={styles.markdown}
            streaming={streaming ? { hasNextChunk: true } : undefined}
          >
            {content}
          </XMarkdown>
        </div>
      )}
      {content && streaming ? (
        <div className={styles.streamingLine}>
          <LoadingOutlined spin />
          <Typography.Text type="secondary">实时输出中</Typography.Text>
        </div>
      ) : null}
      {error ? (
        <Alert
          action={
            <Space wrap>
              {failureRecovery?.action === 'retry' && onRetry ? (
                <Button
                  icon={<ReloadOutlined />}
                  onClick={onRetry}
                  size="small"
                >
                  使用当前模型重试
                </Button>
              ) : null}
              {failureRecovery?.action === 'edit' && onEditRequest ? (
                <Button
                  icon={<EditOutlined />}
                  onClick={onEditRequest}
                  size="small"
                >
                  修改问题
                </Button>
              ) : null}
              {onViewDiagnostics ? (
                <Button
                  icon={<InfoCircleOutlined />}
                  onClick={onViewDiagnostics}
                  size="small"
                >
                  查看诊断
                </Button>
              ) : null}
            </Space>
          }
          description={
            <Space orientation="vertical" size={2}>
              <Typography.Text>{error}</Typography.Text>
              <Typography.Text type="secondary">
                {failureRecovery?.description}
              </Typography.Text>
            </Space>
          }
          showIcon
          title={failureRecovery?.title}
          type={failureRecovery?.alertType}
        />
      ) : null}
      {modelDisplay ? (
        <Tag bordered={false} color={error ? 'error' : 'default'}>
          {modelSelection === 'fixed'
            ? `固定模型：${requestedModelDisplay || modelDisplay}`
            : `自动模型（${modelDisplay}）`}
        </Tag>
      ) : null}
      {detailCitations.length ? (
        <div className={styles.sourceCards}>
          {detailCitations.map((citation, index) => (
            <CitationCard
              citation={citation}
              key={`${citation.type}-${citation.id ?? index}`}
              onDiscardDraft={onDiscardDraft}
              onEditDraft={onEditDraft}
              onHandoffDraft={onHandoffDraft}
              onOpenDraftHistory={onOpenDraftHistory}
              onOpenProduct={onOpenProduct}
            />
          ))}
        </div>
      ) : null}
      {runId && content && !error ? (
        <Space size={8} wrap>
          {onViewRun ? (
            <Button
              aria-label="运行详情"
              icon={<DashboardOutlined />}
              onClick={onViewRun}
              size="small"
              type="link"
            >
              运行详情
            </Button>
          ) : null}
          <Actions
            items={[
              {
                key: 'positive',
                label: '有帮助',
                icon: <LikeOutlined />,
                actionRender:
                  feedback === 'positive' ? (
                    <Button
                      icon={<LikeOutlined />}
                      size="small"
                      type="primary"
                    />
                  ) : undefined,
              },
              {
                key: 'negative',
                label: '需要改进',
                icon: <DislikeOutlined />,
                danger: feedback === 'negative',
              },
            ]}
            onClick={({ key }) =>
              onFeedback(key === 'positive' ? 'positive' : 'negative')
            }
          />
        </Space>
      ) : null}
    </div>
  );
}

export type AiMessageRow = AiChatMessage & {
  error?: string | null;
  errorCode?: string | null;
  id: string;
  modelDisplay?: string | null;
  modelSelection?: 'auto' | 'fixed';
  requestedModelDisplay?: string | null;
  runId?: string | null;
};
