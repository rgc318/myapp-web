import {
  ClearOutlined,
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import {
  type AiVectorCleanupPreview,
  cleanupExcludedAiVectors,
  getAiVectorIndexStatus,
  rebuildAiVectorIndex,
} from '@/services/myapp/ai-governance';
import { notifyMutationError } from '@/services/myapp/mutation';

const { Text } = Typography;

export default function VectorIndexOperations() {
  const [cleanupForm] = Form.useForm<{ reason: string }>();
  const [cleanupPreview, setCleanupPreview] =
    useState<AiVectorCleanupPreview | null>(null);
  const [cleanupSubmitting, setCleanupSubmitting] = useState(false);
  const {
    data: status,
    loading,
    run: refresh,
  } = useRequest(() => getAiVectorIndexStatus(50), {
    formatResult: (result) => result,
  });

  const queueRebuild = async (failedOnly: boolean) => {
    try {
      await rebuildAiVectorIndex({ failedOnly, limit: failedOnly ? 100 : 500 });
      refresh();
    } catch (error) {
      notifyMutationError(error);
    }
  };

  const previewCleanup = async () => {
    setCleanupSubmitting(true);
    try {
      const result = await cleanupExcludedAiVectors({ dryRun: true });
      setCleanupPreview(result.data);
    } catch (error) {
      notifyMutationError(error);
    } finally {
      setCleanupSubmitting(false);
    }
  };

  const executeCleanup = async () => {
    const values = await cleanupForm.validateFields();
    setCleanupSubmitting(true);
    try {
      await cleanupExcludedAiVectors({ dryRun: false, reason: values.reason });
      cleanupForm.resetFields();
      setCleanupPreview(null);
      refresh();
    } catch (error) {
      notifyMutationError(error);
    } finally {
      setCleanupSubmitting(false);
    }
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <ProCard
        extra={
          <Space wrap>
            <Button
              disabled={!status?.dueCount}
              icon={<SyncOutlined />}
              onClick={() => void queueRebuild(false)}
            >
              补建待处理项
            </Button>
            <Button
              danger
              disabled={!status?.counts.failed}
              icon={<WarningOutlined />}
              onClick={() => void queueRebuild(true)}
            >
              重试失败项
            </Button>
            <Button
              icon={<ClearOutlined />}
              loading={cleanupSubmitting}
              onClick={() => void previewCleanup()}
            >
              预检排除向量
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={refresh}
            >
              刷新
            </Button>
          </Space>
        }
        title="在线索引运行状态"
        variant="outlined"
      >
        <Row gutter={[16, 16]}>
          {[
            ['ERP 商品', status?.totalItems ?? 0],
            ['已索引', status?.counts.indexed ?? 0],
            ['待处理', status?.dueCount ?? 0],
            ['失败', status?.counts.failed ?? 0],
            ['排除商品', status?.excludedItemCount ?? 0],
            ['待清理排除项', status?.excludedIndexedCount ?? 0],
          ].map(([title, value]) => (
            <Col key={String(title)} lg={4} sm={8} xs={12}>
              <StatisticCard statistic={{ title, value }} />
            </Col>
          ))}
        </Row>
        <Descriptions column={{ lg: 4, md: 2, sm: 1 }} size="small">
          <Descriptions.Item label="功能开关">
            <Tag color={status?.enabled ? 'success' : 'default'}>
              {status?.enabled ? '已启用' : '未启用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Embedding">
            {status?.embeddingModel || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="在线集合">
            {status?.vectorCollection || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="索引版本">
            {status?.indexVersion || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="排除前缀" span={2}>
            {status?.excludedItemPrefixes.length
              ? status.excludedItemPrefixes.map((prefix) => (
                  <Tag key={prefix}>{prefix}</Tag>
                ))
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Provider" span={2}>
            <Text code>{JSON.stringify(status?.provider ?? {})}</Text>
          </Descriptions.Item>
        </Descriptions>
      </ProCard>

      {status?.recentFailures.length ? (
        <ProCard title="最近索引失败" variant="outlined">
          <Table
            columns={[
              { dataIndex: 'itemCode', title: '商品编码', width: 180 },
              { dataIndex: 'lastAttemptAt', title: '最近尝试', width: 190 },
              { dataIndex: 'lastError', title: '错误摘要' },
            ]}
            dataSource={status.recentFailures}
            pagination={false}
            rowKey="itemCode"
            scroll={{ x: 760 }}
            size="small"
          />
        </ProCard>
      ) : null}

      <Modal
        confirmLoading={cleanupSubmitting}
        destroyOnHidden
        okText="确认清理向量"
        onCancel={() => {
          setCleanupPreview(null);
          cleanupForm.resetFields();
        }}
        onOk={() => void executeCleanup()}
        open={Boolean(cleanupPreview)}
        title="清理排除商品的 AI 向量"
      >
        <Alert
          description="该操作只删除 Qdrant 向量和更新索引状态，不删除、不停用 ERP 商品，也不修改任何历史交易。"
          showIcon
          type="warning"
        />
        <Descriptions column={2} size="small">
          <Descriptions.Item label="排除商品">
            {cleanupPreview?.excludedCount ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="本次选中">
            {cleanupPreview?.selectedCount ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="当前待清理">
            {cleanupPreview?.excludedIndexedCount ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="ERP 商品变化">
            {cleanupPreview?.erpItemsChanged ?? 0}
          </Descriptions.Item>
        </Descriptions>
        <Form form={cleanupForm} layout="vertical">
          <Form.Item
            label="执行原因"
            name="reason"
            rules={[{ message: '请填写清理原因', required: true }]}
          >
            <Input.TextArea maxLength={1000} rows={4} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
