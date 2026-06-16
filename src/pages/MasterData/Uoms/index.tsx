import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Button,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Space,
  Switch,
  Tag,
} from 'antd';
import React, { useRef, useState } from 'react';
import {
  createUom,
  listUoms,
  type SaveUomPayload,
  setUomDisabled,
  type UomSummary,
  updateUom,
} from '@/services/myapp/master-data';

const PAGE_SIZE = 20;

type UomFormValues = SaveUomPayload;

const UomsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<UomFormValues>();
  const [editingUom, setEditingUom] = useState<UomSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingUom, setTogglingUom] = useState<string>();

  const openCreateModal = () => {
    setEditingUom(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      mustBeWholeNumber: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (record: UomSummary) => {
    setEditingUom(record);
    form.setFieldsValue({
      description: record.description,
      enabled: record.enabled,
      mustBeWholeNumber: record.mustBeWholeNumber,
      symbol: record.symbol,
      uomName: record.uomName,
    });
    setModalOpen(true);
  };

  const reload = () => actionRef.current?.reload();

  const handleSubmit = async (values: UomFormValues) => {
    setSubmitting(true);
    try {
      if (editingUom) {
        await updateUom(editingUom.name, {
          description: values.description,
          enabled: values.enabled,
          mustBeWholeNumber: values.mustBeWholeNumber,
          symbol: values.symbol,
        });
      } else {
        await createUom(values);
      }
      setModalOpen(false);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnabled = async (record: UomSummary) => {
    setTogglingUom(record.name);
    try {
      await setUomDisabled(record.name, record.enabled);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setTogglingUom(undefined);
    }
  };

  const columns: ProColumns<UomSummary>[] = [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '单位名称 / 符号 / 说明',
      },
    },
    {
      title: '状态',
      dataIndex: 'enabledFilter',
      hideInTable: true,
      initialValue: 'all',
      valueEnum: {
        all: { text: '全部' },
        enabled: { text: '启用' },
        disabled: { text: '停用' },
      },
    },
    {
      title: '单位',
      dataIndex: 'name',
      search: false,
      width: 140,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      search: false,
      width: 140,
    },
    {
      title: '符号',
      dataIndex: 'symbol',
      search: false,
      width: 90,
      renderText: (value) => value || '-',
    },
    {
      title: '业务说明',
      dataIndex: 'description',
      search: false,
      ellipsis: true,
      renderText: (value) => value || '-',
    },
    {
      title: '整数单位',
      dataIndex: 'mustBeWholeNumber',
      search: false,
      width: 120,
      render: (_, record) =>
        record.mustBeWholeNumber ? <Tag color="blue">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      search: false,
      width: 90,
      render: (_, record) =>
        record.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => openEditModal(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="toggle"
          cancelText="取消"
          okText={record.enabled ? '停用' : '启用'}
          onConfirm={() => handleToggleEnabled(record)}
          title={`${record.enabled ? '停用' : '启用'}单位 ${record.displayName || record.name}？`}
        >
          <Button
            danger={record.enabled}
            loading={togglingUom === record.name}
            type="link"
          >
            {record.enabled ? '停用' : '启用'}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer
      title="计量单位"
      extra={[
        <Button key="create" type="primary" onClick={openCreateModal}>
          新增单位
        </Button>,
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<UomSummary>
        actionRef={actionRef}
        columns={columns}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const enabledFilter = String(params.enabledFilter ?? 'all');
          const result = await listUoms({
            enabled:
              enabledFilter === 'enabled'
                ? 1
                : enabledFilter === 'disabled'
                  ? 0
                  : undefined,
            limit: pageSize,
            searchKey: String(params.searchKey ?? ''),
            start: (current - 1) * pageSize,
          });

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey="name"
        search={{
          defaultCollapsed: false,
          labelWidth: 88,
        }}
        toolBarRender={false}
      />
      <Modal
        confirmLoading={submitting}
        destroyOnHidden
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        open={modalOpen}
        title={editingUom ? `编辑单位 ${editingUom.name}` : '新增单位'}
      >
        <Form<UomFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="单位名称"
            name="uomName"
            rules={[{ required: true, message: '请输入单位名称' }]}
          >
            <Input disabled={Boolean(editingUom)} placeholder="例如 Box" />
          </Form.Item>
          <Form.Item label="符号" name="symbol">
            <Input placeholder="例如 箱" />
          </Form.Item>
          <Form.Item label="业务说明" name="description">
            <Input.TextArea
              autoSize={{ maxRows: 4, minRows: 2 }}
              placeholder="说明该单位的业务用途"
            />
          </Form.Item>
          <Space size={32}>
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              label="必须整数"
              name="mustBeWholeNumber"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default UomsPage;
