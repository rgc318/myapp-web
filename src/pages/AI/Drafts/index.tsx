import {
  DeleteOutlined,
  EyeOutlined,
  MessageOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import {
  type AiDraft,
  discardAiDraft,
  getAiDraft,
  listAiDrafts,
  prepareAiDraftHandoff,
} from '@/services/myapp/ai';

const DRAFT_TYPE: Record<AiDraft['draftType'], string> = {
  inventory_adjustment: '库存调整',
  purchase_order: '采购订单',
  sales_order: '销售订单',
};

const STATUS: Record<string, { color: string; text: string }> = {
  discarded: { color: 'default', text: '已放弃' },
  draft: { color: 'processing', text: '待复核' },
  handed_off: { color: 'success', text: '已交接业务编辑器' },
};

export default function AiDraftsPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [detail, setDetail] = useState<AiDraft | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (draft: AiDraft) => {
    setDetail(draft);
    setDetailLoading(true);
    try {
      setDetail(await getAiDraft(draft.name));
    } finally {
      setDetailLoading(false);
    }
  };

  const handoff = async (draft: AiDraft) => {
    const { draftType, payload } = await prepareAiDraftHandoff(draft.name);
    const isPurchase = draftType === 'purchase_order';
    const isInventory = draftType === 'inventory_adjustment';
    sessionStorage.setItem(
      `myapp:ai-${isInventory ? 'inventory-adjustment' : isPurchase ? 'purchase' : 'sales'}-draft:${draft.name}`,
      JSON.stringify(payload),
    );
    history.push(
      `${isInventory ? '/inventory/adjustments' : isPurchase ? '/purchase/orders/new' : '/sales/orders/new'}?ai_draft=${encodeURIComponent(draft.name)}`,
    );
  };

  const discard = (draft: AiDraft) => {
    Modal.confirm({
      content: '放弃后草稿仍保留审计记录，但不能继续交接业务编辑器。',
      okButtonProps: { danger: true },
      okText: '确认放弃',
      onOk: async () => {
        await discardAiDraft(draft.name);
        setDetail(null);
        actionRef.current?.reload();
      },
      title: `放弃草稿 ${draft.name}？`,
    });
  };

  const columns: ProColumns<AiDraft>[] = [
    {
      dataIndex: 'name',
      title: '草稿',
      width: 230,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <a onClick={() => void openDetail(row)}>{row.title}</a>
          <Typography.Text copyable type="secondary">
            {row.name}
          </Typography.Text>
        </Space>
      ),
    },
    {
      dataIndex: 'draftType',
      title: '类型',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(DRAFT_TYPE).map(([key, text]) => [key, { text }]),
      ),
      width: 130,
      renderText: (value) => DRAFT_TYPE[value as AiDraft['draftType']] ?? value,
    },
    {
      dataIndex: 'status',
      title: '状态',
      valueType: 'select',
      valueEnum: {
        all: { text: '全部' },
        discarded: { text: '已放弃' },
        draft: { text: '待复核' },
        handed_off: { text: '已交接' },
      },
      width: 130,
      render: (_, row) => {
        const item = STATUS[row.status] ?? {
          color: 'default',
          text: row.status,
        };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    { dataIndex: 'company', title: '公司', search: false, width: 180 },
    {
      title: '校验',
      search: false,
      width: 160,
      render: (_, row) =>
        row.validation.readyForHandoff ? (
          <Tag color="success">可交接</Tag>
        ) : (
          <Tag color="warning">
            {row.validation.errors.length || row.validation.warnings.length}{' '}
            项待确认
          </Tag>
        ),
    },
    { dataIndex: 'version', title: '版本', search: false, width: 90 },
    {
      dataIndex: 'modified',
      title: '最近修改',
      search: false,
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 230,
      render: (_, row) => [
        <a key="detail" onClick={() => void openDetail(row)}>
          <EyeOutlined /> 详情
        </a>,
        row.conversationId ? (
          <a
            key="conversation"
            onClick={() =>
              history.push(
                `/ai?conversation=${encodeURIComponent(row.conversationId ?? '')}`,
              )
            }
          >
            <MessageOutlined /> 来源会话
          </a>
        ) : null,
        row.status === 'draft' && row.validation.readyForHandoff ? (
          <a key="handoff" onClick={() => void handoff(row)}>
            <SendOutlined /> 交接
          </a>
        ) : null,
      ],
    },
  ];

  return (
    <PageContainer
      onBack={() => history.push('/ai')}
      subTitle="集中复核、追踪和交接由 AI 生成的业务草稿"
      title="我的 AI 草稿"
    >
      <Alert
        description="草稿只属于当前登录用户。进入业务编辑器后仍需人工核对并主动保存，AI 不会创建或提交正式单据。"
        showIcon
        style={{ marginBottom: 16 }}
        type="info"
      />
      <ProTable<AiDraft>
        actionRef={actionRef}
        cardBordered
        columns={columns}
        request={async (params) => {
          const result = await listAiDrafts({
            current: params.current,
            draftType: params.draftType,
            pageSize: params.pageSize,
            status: params.status ?? 'draft',
          });
          return { data: result.items, success: true, total: result.total };
        }}
        rowKey="name"
        scroll={{ x: 1350 }}
        search={{ labelWidth: 'auto' }}
      />

      <Drawer
        extra={
          detail ? (
            <Space>
              {detail.status === 'draft' &&
              detail.validation.readyForHandoff ? (
                <Button
                  icon={<SendOutlined />}
                  onClick={() => void handoff(detail)}
                  type="primary"
                >
                  进入业务编辑器
                </Button>
              ) : null}
              {detail.status === 'draft' ? (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => discard(detail)}
                >
                  放弃
                </Button>
              ) : null}
            </Space>
          ) : null
        }
        loading={detailLoading}
        onClose={() => setDetail(null)}
        open={Boolean(detail)}
        title={detail?.title ?? 'AI 草稿详情'}
        width={880}
      >
        {detail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="草稿编号">
                <Typography.Text copyable>{detail.name}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                {DRAFT_TYPE[detail.draftType]}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS[detail.status]?.color}>
                  {STATUS[detail.status]?.text ?? detail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本">
                v{detail.version}
              </Descriptions.Item>
              <Descriptions.Item label="公司">
                {detail.company || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="来源 Run">
                <Typography.Text copyable>
                  {detail.sourceRun || '-'}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
            {detail.validation.errors.map((error) => (
              <Alert key={error} showIcon title={error} type="error" />
            ))}
            {detail.validation.warnings.map((warning) => (
              <Alert key={warning} showIcon title={warning} type="warning" />
            ))}
            <Typography.Title level={5}>结构化载荷</Typography.Title>
            <Typography.Paragraph code copyable>
              {JSON.stringify(detail.payload, null, 2)}
            </Typography.Paragraph>
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  );
}
