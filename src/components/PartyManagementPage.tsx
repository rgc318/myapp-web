import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Button,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
} from 'antd';
import React, { useRef, useState } from 'react';
import type { PageResult } from '@/services/myapp/api-utils';
import type {
  ListOptions,
  PartySummary,
  SavePartyPayload,
} from '@/services/myapp/master-data';

const PAGE_SIZE = 20;

type PartyFormValues = SavePartyPayload;

type PartyManagementPageProps = {
  createParty: (payload: SavePartyPayload) => Promise<unknown>;
  defaultGroup?: string;
  defaultType?: string;
  listParties: (options?: ListOptions) => Promise<PageResult<PartySummary>>;
  partyLabel: string;
  searchPlaceholder: string;
  setPartyDisabled: (name: string, disabled: boolean) => Promise<unknown>;
  updateParty: (
    name: string,
    payload: Omit<SavePartyPayload, 'name'> & { name?: string },
  ) => Promise<unknown>;
};

const partyTypeOptions = [
  { label: '公司', value: 'Company' },
  { label: '个人', value: 'Individual' },
];

const statusFilterValueEnum = {
  all: { text: '全部' },
  enabled: { text: '启用' },
  disabled: { text: '停用' },
};

const PartyManagementPage: React.FC<PartyManagementPageProps> = ({
  createParty,
  defaultGroup,
  defaultType = 'Company',
  listParties,
  partyLabel,
  searchPlaceholder,
  setPartyDisabled,
  updateParty,
}) => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<PartyFormValues>();
  const [editingParty, setEditingParty] = useState<PartySummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingParty, setTogglingParty] = useState<string>();

  const reload = () => actionRef.current?.reload();

  const openCreateModal = () => {
    setEditingParty(null);
    form.resetFields();
    form.setFieldsValue({
      disabled: false,
      group: defaultGroup,
      type: defaultType,
    });
    setModalOpen(true);
  };

  const openEditModal = (record: PartySummary) => {
    setEditingParty(record);
    form.setFieldsValue({
      defaultCurrency: record.defaultCurrency,
      disabled: record.disabled,
      email: record.email,
      group: record.group,
      mobileNo: record.mobileNo,
      name: record.displayName || record.name,
      remarks: record.remarks,
      type: record.type,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: PartyFormValues) => {
    setSubmitting(true);
    try {
      if (editingParty) {
        await updateParty(editingParty.name, {
          defaultCurrency: values.defaultCurrency,
          disabled: values.disabled,
          email: values.email,
          group: values.group,
          mobileNo: values.mobileNo,
          name: values.name,
          remarks: values.remarks,
          type: values.type,
        });
      } else {
        await createParty(values);
      }
      setModalOpen(false);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisabled = async (record: PartySummary) => {
    setTogglingParty(record.name);
    try {
      await setPartyDisabled(record.name, !record.disabled);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setTogglingParty(undefined);
    }
  };

  const columns: ProColumns<PartySummary>[] = [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: searchPlaceholder,
      },
    },
    {
      title: '状态',
      dataIndex: 'disabledFilter',
      hideInTable: true,
      initialValue: 'all',
      valueEnum: statusFilterValueEnum,
    },
    {
      title: `${partyLabel}编码`,
      dataIndex: 'name',
      search: false,
      width: 180,
    },
    {
      title: `${partyLabel}名称`,
      dataIndex: 'displayName',
      search: false,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      search: false,
      width: 110,
      renderText: (value) => value || '-',
    },
    {
      title: '分组',
      dataIndex: 'group',
      search: false,
      width: 140,
      renderText: (value) => value || '-',
    },
    {
      title: '手机',
      dataIndex: 'mobileNo',
      search: false,
      width: 140,
      renderText: (value) => value || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      search: false,
      ellipsis: true,
      renderText: (value) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      search: false,
      width: 90,
      render: (_, record) =>
        record.disabled ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>,
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
          okText={record.disabled ? '启用' : '停用'}
          onConfirm={() => handleToggleDisabled(record)}
          title={`${record.disabled ? '启用' : '停用'}${partyLabel} ${record.displayName || record.name}？`}
        >
          <Button
            danger={!record.disabled}
            loading={togglingParty === record.name}
            type="link"
          >
            {record.disabled ? '启用' : '停用'}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer
      title={partyLabel}
      extra={[
        <Button key="create" type="primary" onClick={openCreateModal}>
          新增{partyLabel}
        </Button>,
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<PartySummary>
        actionRef={actionRef}
        columns={columns}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const disabledFilter = String(params.disabledFilter ?? 'all');
          const result = await listParties({
            disabled:
              disabledFilter === 'enabled'
                ? 0
                : disabledFilter === 'disabled'
                  ? 1
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
        title={
          editingParty
            ? `编辑${partyLabel} ${editingParty.name}`
            : `新增${partyLabel}`
        }
      >
        <Form<PartyFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label={`${partyLabel}名称`}
            name="name"
            rules={[{ required: true, message: `请输入${partyLabel}名称` }]}
          >
            <Input placeholder={`${partyLabel}名称`} />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item label="类型" name="type" style={{ minWidth: 160 }}>
              <Select options={partyTypeOptions} />
            </Form.Item>
            <Form.Item label="分组" name="group" style={{ minWidth: 200 }}>
              <Input placeholder={`${partyLabel}分组`} />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item label="手机" name="mobileNo" style={{ minWidth: 200 }}>
              <Input placeholder="手机" />
            </Form.Item>
            <Form.Item label="邮箱" name="email" style={{ minWidth: 220 }}>
              <Input placeholder="邮箱" />
            </Form.Item>
          </Space>
          <Form.Item label="默认币种" name="defaultCurrency">
            <Input placeholder="例如 CNY" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
          </Form.Item>
          <Form.Item label="停用" name="disabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default PartyManagementPage;
