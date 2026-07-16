import {
  CheckCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import {
  type AiModel,
  type AiVectorRelease,
  approveAiVectorRelease,
  createAiVectorRelease,
  getAiVectorRelease,
  listAiVectorReleases,
  publishAiVectorRelease,
  retryAiVectorRelease,
  rollbackAiVectorRelease,
  validateAiVectorRelease,
} from '@/services/myapp/ai-governance';
import { notifyMutationError } from '@/services/myapp/mutation';
import VectorIndexOperations from './VectorIndexOperations';

const { Paragraph, Text } = Typography;

const STATUS: Record<string, { color: string; text: string }> = {
  active: { color: 'success', text: '当前生效' },
  approved: { color: 'cyan', text: '已审批' },
  building: { color: 'processing', text: '构建中' },
  failed: { color: 'error', text: '构建失败' },
  review_required: { color: 'warning', text: '待审批' },
  superseded: { color: 'default', text: '已替代/可回滚' },
};

type Props = {
  access: Record<string, boolean>;
  models: AiModel[];
  onChanged: () => void;
};

export default function VectorReleases({ access, models, onChanged }: Props) {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [createForm] = Form.useForm();
  const [actionForm] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof getAiVectorRelease>
  > | null>(null);
  const [releaseAction, setReleaseAction] = useState<{
    kind: 'approve' | 'publish' | 'rollback';
    release: AiVectorRelease;
  } | null>(null);

  const reload = () => {
    actionRef.current?.reload();
    onChanged();
  };

  const openDetail = async (release: AiVectorRelease) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await getAiVectorRelease(release.releaseCode));
    } catch (error) {
      notifyMutationError(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const directAction = async (
    action: (releaseCode: string) => Promise<unknown>,
    release: AiVectorRelease,
  ) => {
    try {
      await action(release.releaseCode);
      reload();
    } catch (error) {
      notifyMutationError(error);
    }
  };

  const columns: ProColumns<AiVectorRelease>[] = [
    {
      title: '发布版本',
      dataIndex: 'releaseCode',
      width: 200,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <a onClick={() => openDetail(row)}>{row.releaseCode}</a>
          <Text type="secondary">{row.environment}</Text>
        </Space>
      ),
    },
    {
      title: 'Alias → Collection',
      width: 260,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{row.aliasName}</Text>
          <Text type="secondary">→ {row.collectionName}</Text>
        </Space>
      ),
    },
    {
      title: 'Embedding / 索引',
      width: 230,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>{row.embeddingModel}</Text>
          <Text type="secondary">{row.indexVersion}</Text>
        </Space>
      ),
    },
    {
      title: '构建进度',
      width: 220,
      render: (_, row) => {
        const percent = row.totalItems
          ? Math.round((row.indexedCount / row.totalItems) * 100)
          : 0;
        return (
          <Space orientation="vertical" size={0} style={{ width: '100%' }}>
            <Progress
              percent={percent}
              size="small"
              status={row.failedCount ? 'exception' : undefined}
            />
            <Text type="secondary">
              {row.indexedCount}/{row.totalItems}，失败 {row.failedCount}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (_, row) => {
        const item = STATUS[row.status] ?? {
          color: 'default',
          text: row.status,
        };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: '向量维度',
      dataIndex: 'vectorSize',
      width: 100,
      renderText: (value) => value || '-',
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 250,
      render: (_, row) => {
        const actions = [
          <a key="detail" onClick={() => openDetail(row)}>
            详情
          </a>,
        ];
        if (
          access.canManageAiGovernance &&
          ['building', 'failed'].includes(row.status)
        ) {
          actions.push(
            <a
              key="retry"
              onClick={() => directAction(retryAiVectorRelease, row)}
            >
              重试
            </a>,
            <a
              key="validate"
              onClick={() => directAction(validateAiVectorRelease, row)}
            >
              校验门禁
            </a>,
          );
        }
        if (access.canApproveAiGovernance && row.status === 'review_required') {
          actions.push(
            <a
              key="approve"
              onClick={() =>
                setReleaseAction({ kind: 'approve', release: row })
              }
            >
              审批
            </a>,
          );
        }
        if (access.canPublishAiGovernance && row.status === 'approved') {
          actions.push(
            <a
              key="publish"
              onClick={() =>
                setReleaseAction({ kind: 'publish', release: row })
              }
            >
              原子发布
            </a>,
          );
        }
        if (access.canPublishAiGovernance && row.status === 'superseded') {
          actions.push(
            <a
              key="rollback"
              onClick={() =>
                setReleaseAction({ kind: 'rollback', release: row })
              }
            >
              回滚到此版本
            </a>,
          );
        }
        return actions;
      },
    },
  ];

  return (
    <>
      {access.canPublishAiGovernance ? <VectorIndexOperations /> : null}
      <Alert
        showIcon
        type="warning"
        title="Embedding 模型不得原地替换向量空间。新版本必须使用新物理 collection 完成全量补建和 full gate，随后通过稳定 alias 原子切换。"
        style={{ marginBottom: 16 }}
      />
      <ProTable<AiVectorRelease>
        actionRef={actionRef}
        rowKey="releaseCode"
        columns={columns}
        search={false}
        cardBordered={false}
        scroll={{ x: 1450 }}
        request={async (params) => {
          const result = await listAiVectorReleases({
            current: params.current,
            pageSize: params.pageSize,
          });
          return { data: result.items, success: true, total: result.total };
        }}
        toolBarRender={() =>
          access.canManageAiGovernance
            ? [
                <Button
                  key="new"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    createForm.setFieldsValue({
                      aliasName: 'myapp-products-live',
                      environment: 'development',
                      indexVersion: 'product-semantic-v2',
                    });
                    setCreateOpen(true);
                  }}
                >
                  新建候选版本
                </Button>,
              ]
            : []
        }
      />

      <Modal
        title="新建 Embedding 候选版本"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await createAiVectorRelease(values, values.reason);
              setCreateOpen(false);
              createForm.resetFields();
              reload();
            } catch (error) {
              notifyMutationError(error);
            }
          }}
        >
          <Form.Item
            name="releaseCode"
            label="发布编码"
            rules={[{ required: true }]}
          >
            <Input placeholder="products-embedding-v2" />
          </Form.Item>
          <Form.Item
            name="aliasName"
            label="稳定 Alias"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="collectionName"
            label="新物理 Collection"
            rules={[{ required: true }]}
          >
            <Input placeholder="myapp-products-v2" />
          </Form.Item>
          <Form.Item
            name="embeddingModel"
            label="Embedding 模型"
            rules={[{ required: true }]}
          >
            <Select
              options={models
                .filter((model) => model.capability === 'embedding')
                .map((model) => ({
                  label: model.modelAlias,
                  value: model.modelAlias,
                }))}
            />
          </Form.Item>
          <Form.Item
            name="indexVersion"
            label="内容索引版本"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="environment"
            label="环境"
            rules={[{ required: true }]}
          >
            <Select
              options={['development', 'test', 'staging', 'production'].map(
                (value) => ({
                  label: value,
                  value,
                }),
              )}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="创建原因"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        width={760}
        title={`向量发布详情 · ${detail?.release.releaseCode ?? ''}`}
        open={detailOpen}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        extra={
          detail ? (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => openDetail(detail.release)}
            >
              刷新
            </Button>
          ) : null
        }
      >
        {detail ? (
          <Space
            orientation="vertical"
            size="large"
            style={{ display: 'flex' }}
          >
            <Descriptions
              bordered
              column={2}
              items={[
                {
                  key: 'status',
                  label: '状态',
                  children: detail.release.status,
                },
                {
                  key: 'vector',
                  label: '维度',
                  children: detail.release.vectorSize || '-',
                },
                {
                  key: 'alias',
                  label: 'Alias',
                  children: detail.release.aliasName,
                },
                {
                  key: 'collection',
                  label: 'Collection',
                  children: detail.release.collectionName,
                },
                {
                  key: 'model',
                  label: '模型',
                  children: detail.release.embeddingModel,
                },
                {
                  key: 'index',
                  label: '索引版本',
                  children: detail.release.indexVersion,
                },
                {
                  key: 'progress',
                  label: '构建',
                  span: 2,
                  children: `${detail.release.indexedCount}/${detail.release.totalItems}，失败 ${detail.release.failedCount}`,
                },
              ]}
            />
            <div>
              <Text strong>Qdrant 状态</Text>
              <Paragraph copyable>
                <pre>{JSON.stringify(detail.provider, null, 2)}</pre>
              </Paragraph>
            </div>
            <div>
              <Text strong>门禁证据</Text>
              <Paragraph copyable>
                <pre>
                  {JSON.stringify(detail.release.validation ?? {}, null, 2)}
                </pre>
              </Paragraph>
            </div>
            <Table
              rowKey="item_code"
              pagination={false}
              dataSource={detail.failures}
              columns={[
                { title: '失败商品', dataIndex: 'item_code' },
                { title: '错误', dataIndex: 'last_error', ellipsis: true },
                { title: '最后尝试', dataIndex: 'last_attempt_at' },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title={
          releaseAction?.kind === 'approve'
            ? '审批 Embedding 发布'
            : releaseAction?.kind === 'publish'
              ? '原子切换 Alias'
              : '回滚 Embedding Alias'
        }
        open={Boolean(releaseAction)}
        onCancel={() => setReleaseAction(null)}
        onOk={() => actionForm.submit()}
        okButtonProps={{
          danger: releaseAction?.kind === 'rollback',
          icon:
            releaseAction?.kind === 'rollback' ? (
              <RollbackOutlined />
            ) : releaseAction?.kind === 'publish' ? (
              <SafetyCertificateOutlined />
            ) : (
              <CheckCircleOutlined />
            ),
        }}
        destroyOnHidden
      >
        <Alert
          type={releaseAction?.kind === 'rollback' ? 'warning' : 'info'}
          showIcon
          title={`${releaseAction?.release.aliasName ?? ''} → ${releaseAction?.release.collectionName ?? ''}`}
          style={{ marginBottom: 16 }}
        />
        <Form
          form={actionForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!releaseAction) return;
            try {
              if (releaseAction.kind === 'approve') {
                await approveAiVectorRelease(
                  releaseAction.release.releaseCode,
                  values.reason,
                );
              } else if (releaseAction.kind === 'publish') {
                await publishAiVectorRelease(
                  releaseAction.release.releaseCode,
                  values.reason,
                );
              } else {
                await rollbackAiVectorRelease(
                  releaseAction.release.releaseCode,
                  values.reason,
                );
              }
              setReleaseAction(null);
              actionForm.resetFields();
              reload();
            } catch (error) {
              notifyMutationError(error);
            }
          }}
        >
          <Form.Item
            name="reason"
            label="操作原因"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
