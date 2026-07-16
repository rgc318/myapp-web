import {
  DislikeOutlined,
  FileTextOutlined,
  LikeOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { Actions, Sources } from '@ant-design/x';
import XMarkdown from '@ant-design/x-markdown';
import { Button, Space, Tag, Typography } from 'antd';
import type { AiChatMessage, AiCitation } from '@/services/myapp/ai';
import { useAiWorkspaceStyles } from '../styles';

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
  feedback?: 'positive' | 'negative';
  onDiscardDraft: (draftId: string) => void;
  onEditDraft: (citation: AiCitation) => void;
  onFeedback: (rating: 'positive' | 'negative') => void;
  onHandoffDraft: (draftId: string) => void;
  onOpenDraftHistory: (draftId: string) => void;
  runId?: string | null;
  streaming?: boolean;
};

function draftValidation(citation: AiCitation) {
  return citation.data.validation as Record<string, unknown> | undefined;
}

function CitationCard({
  citation,
  onDiscardDraft,
  onEditDraft,
  onHandoffDraft,
  onOpenDraftHistory,
}: Pick<
  Props,
  'onDiscardDraft' | 'onEditDraft' | 'onHandoffDraft' | 'onOpenDraftHistory'
> & { citation: AiCitation }) {
  const validation = draftValidation(citation);
  return (
    <ProCard
      size="small"
      title={citation.label}
      extra={
        citation.href ? (
          <Button href={citation.href} size="small" type="link">
            查看详情
          </Button>
        ) : null
      }
    >
      {citation.type === 'product' ? (
        <Space size={[8, 4]} wrap>
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
      ) : citation.type === 'ai_draft' ? (
        <Space orientation="vertical" size={8}>
          <Space wrap>
            <Tag>版本 {Number(citation.data.version ?? 1)}</Tag>
            <Tag color={citation.data.status === 'draft' ? 'blue' : 'default'}>
              {String(citation.data.status ?? 'draft')}
            </Tag>
          </Space>
          <Typography.Text>
            {validation?.ready_for_handoff
              ? citation.data.draft_type === 'inventory_adjustment'
                ? '草稿已通过实时库存校验，可进入库存调整编辑器复核。'
                : `草稿已通过后端校验，可进入${citation.data.draft_type === 'purchase_order' ? '采购' : '销售'}订单编辑器复核。`
              : '草稿仍有业务对象、商品、数量、单位、仓库或原因需要人工确认。'}
          </Typography.Text>
          {Array.isArray(validation?.errors)
            ? validation.errors.map((error) => (
                <Typography.Text key={String(error)} type="danger">
                  {String(error)}
                </Typography.Text>
              ))
            : null}
          <Space wrap>
            <Button
              disabled={citation.data.status !== 'draft'}
              onClick={() => onEditDraft(citation)}
            >
              编辑并重新校验
            </Button>
            <Button
              onClick={() => onOpenDraftHistory(String(citation.id ?? ''))}
            >
              版本历史
            </Button>
            <Button
              disabled={
                citation.data.status === 'discarded' ||
                !validation?.ready_for_handoff
              }
              onClick={() => onHandoffDraft(String(citation.id ?? ''))}
              type="primary"
            >
              进入业务编辑器
            </Button>
            <Button
              danger
              disabled={citation.data.status === 'discarded'}
              onClick={() => onDiscardDraft(String(citation.id ?? ''))}
            >
              {citation.data.status === 'discarded' ? '已放弃' : '放弃草稿'}
            </Button>
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
  feedback,
  onDiscardDraft,
  onEditDraft,
  onFeedback,
  onHandoffDraft,
  onOpenDraftHistory,
  runId,
  streaming,
}: Props) {
  const { styles } = useAiWorkspaceStyles();
  const sources = citations.map((citation, index) => ({
    key: `${citation.type}-${citation.id ?? index}`,
    title: citation.label,
    url: citation.href ?? undefined,
    icon:
      citation.type === 'product' ? <ShoppingOutlined /> : <FileTextOutlined />,
  }));

  return (
    <div className={styles.messageBody}>
      <XMarkdown streaming={streaming ? { hasNextChunk: true } : undefined}>
        {content}
      </XMarkdown>
      {sources.length ? (
        <Sources defaultExpanded items={sources} title="业务来源" />
      ) : null}
      {citations.length ? (
        <div className={styles.sourceCards}>
          {citations.map((citation, index) => (
            <CitationCard
              citation={citation}
              key={`${citation.type}-${citation.id ?? index}`}
              onDiscardDraft={onDiscardDraft}
              onEditDraft={onEditDraft}
              onHandoffDraft={onHandoffDraft}
              onOpenDraftHistory={onOpenDraftHistory}
            />
          ))}
        </div>
      ) : null}
      {runId && content ? (
        <Actions
          items={[
            {
              key: 'positive',
              label: '有帮助',
              icon: <LikeOutlined />,
              actionRender:
                feedback === 'positive' ? (
                  <Button icon={<LikeOutlined />} size="small" type="primary" />
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
      ) : null}
    </div>
  );
}

export type AiMessageRow = AiChatMessage & {
  id: string;
  runId?: string | null;
};
