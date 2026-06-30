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
import { RemoteLinkSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  createWarehouse,
  listWarehouses,
  type SaveWarehousePayload,
  setWarehouseDisabled,
  updateWarehouse,
  type WarehouseSummary,
} from '@/services/myapp/master-data';

const PAGE_SIZE = 20;

type WarehouseFormValues = SaveWarehousePayload;

const WarehousesPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<WarehouseFormValues>();
  const { defaultCompany } = useWorkspacePreferences();
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingWarehouse, setTogglingWarehouse] = useState<string>();
  const formCompany = Form.useWatch('company', form);

  const reload = () => actionRef.current?.reload();

  const openCreateModal = () => {
    setEditingWarehouse(null);
    form.resetFields();
    form.setFieldsValue({
      company: defaultCompany,
      disabled: false,
      isGroup: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (record: WarehouseSummary) => {
    setEditingWarehouse(record);
    form.setFieldsValue({
      account: record.account,
      addressLine1: record.addressLine1,
      addressLine2: record.addressLine2,
      city: record.city,
      company: record.company,
      customer: record.customer,
      defaultInTransitWarehouse: record.defaultInTransitWarehouse,
      disabled: record.disabled,
      emailId: record.emailId,
      isGroup: record.isGroup,
      isRejectedWarehouse: record.isRejectedWarehouse,
      mobileNo: record.mobileNo,
      parentWarehouse: record.parentWarehouse,
      phoneNo: record.phoneNo,
      pin: record.pin,
      state: record.state,
      warehouseName: record.warehouseName,
      warehouseType: record.warehouseType,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: WarehouseFormValues) => {
    setSubmitting(true);
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.name, values);
      } else {
        await createWarehouse(values);
      }
      setModalOpen(false);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisabled = async (record: WarehouseSummary) => {
    setTogglingWarehouse(record.name);
    try {
      await setWarehouseDisabled(record.name, !record.disabled);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setTogglingWarehouse(undefined);
    }
  };

  const columns: ProColumns<WarehouseSummary>[] = [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '仓库名称 / 编码 / 公司 / 父仓库',
      },
    },
    {
      title: '公司',
      dataIndex: 'company',
      hideInTable: true,
      initialValue: defaultCompany,
      formItemRender: (_, { onChange, value }, formRef) => (
        <RemoteLinkSelect
          doctype="Company"
          onChange={(nextValue) => {
            const company = toOptionalText(nextValue);
            formRef.setFieldValue?.('company', company);
            onChange?.(company);
          }}
          placeholder="搜索公司"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(formRef.getFieldValue?.('company'))
          }
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'disabledFilter',
      hideInTable: true,
      initialValue: 'active',
      valueEnum: {
        all: { text: '全部' },
        active: { text: '启用' },
        disabled: { text: '停用' },
      },
    },
    {
      title: '类型',
      dataIndex: 'groupFilter',
      hideInTable: true,
      initialValue: 'all',
      valueEnum: {
        all: { text: '全部' },
        leaf: { text: '可用仓库' },
        group: { text: '分组仓库' },
      },
    },
    {
      title: '仓库',
      dataIndex: 'name',
      search: false,
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.name}</span>
          {record.warehouseName && record.warehouseName !== record.name ? (
            <span style={{ color: '#8c8c8c' }}>{record.warehouseName}</span>
          ) : null}
        </Space>
      ),
    },
    {
      title: '公司',
      dataIndex: 'company',
      search: false,
      ellipsis: true,
      width: 180,
    },
    {
      title: '父仓库',
      dataIndex: 'parentWarehouse',
      search: false,
      ellipsis: true,
      width: 200,
      renderText: (value) => value || '-',
    },
    {
      title: '类型',
      dataIndex: 'isGroup',
      search: false,
      width: 100,
      render: (_, record) =>
        record.isGroup ? <Tag color="blue">分组</Tag> : <Tag>可用</Tag>,
    },
    {
      title: '仓库类型',
      dataIndex: 'warehouseType',
      search: false,
      width: 120,
      renderText: (value) => value || '-',
    },
    {
      title: '会计科目',
      dataIndex: 'account',
      search: false,
      ellipsis: true,
      width: 180,
      renderText: (value) => value || '-',
    },
    {
      title: '联系信息',
      dataIndex: 'phoneNo',
      search: false,
      ellipsis: true,
      width: 180,
      render: (_, record) =>
        [record.phoneNo, record.mobileNo, record.emailId]
          .filter(Boolean)
          .join(' / ') || '-',
    },
    {
      title: '标记',
      dataIndex: 'isRejectedWarehouse',
      search: false,
      width: 120,
      render: (_, record) =>
        record.isRejectedWarehouse ? <Tag color="red">拒收仓</Tag> : '-',
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
      title: '地址',
      dataIndex: 'addressLine1',
      search: false,
      ellipsis: true,
      render: (_, record) =>
        [record.addressLine1, record.addressLine2, record.city, record.state]
          .filter(Boolean)
          .join(' / ') || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'modified',
      search: false,
      width: 180,
      renderText: (value) => value || '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => openEditModal(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="toggle"
          cancelText="取消"
          okText={record.disabled ? '启用' : '停用'}
          onConfirm={() => handleToggleDisabled(record)}
          title={`${record.disabled ? '启用' : '停用'}仓库 ${record.name}？`}
        >
          <Button
            danger={!record.disabled}
            loading={togglingWarehouse === record.name}
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
      title="仓库"
      extra={[
        <Button key="create" type="primary" onClick={openCreateModal}>
          新增仓库
        </Button>,
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<WarehouseSummary>
        actionRef={actionRef}
        columns={columns}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const disabledFilter = String(params.disabledFilter ?? 'active');
          const groupFilter = String(params.groupFilter ?? 'all');
          const result = await listWarehouses({
            company: toOptionalText(params.company),
            disabled:
              disabledFilter === 'active'
                ? 0
                : disabledFilter === 'disabled'
                  ? 1
                  : undefined,
            isGroup:
              groupFilter === 'group' ? 1 : groupFilter === 'leaf' ? 0 : 'all',
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
        scroll={{ x: 1180 }}
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
          editingWarehouse ? `编辑仓库 ${editingWarehouse.name}` : '新增仓库'
        }
      >
        <Form<WarehouseFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="仓库名称"
            name="warehouseName"
            rules={[{ required: true, message: '请输入仓库名称' }]}
          >
            <Input placeholder="例如 Stores" />
          </Form.Item>
          <Form.Item
            label="公司"
            name="company"
            rules={[{ required: true, message: '请选择公司' }]}
          >
            <RemoteLinkSelect doctype="Company" placeholder="搜索公司" />
          </Form.Item>
          <Form.Item label="父仓库" name="parentWarehouse">
            <RemoteLinkSelect
              doctype="Warehouse"
              filters={{ company: formCompany, disabled: 0, is_group: 1 }}
              placeholder="搜索分组仓库"
            />
          </Form.Item>
          <Form.Item label="仓库类型" name="warehouseType">
            <RemoteLinkSelect
              doctype="Warehouse Type"
              placeholder="搜索仓库类型"
            />
          </Form.Item>
          <Form.Item label="会计科目" name="account">
            <RemoteLinkSelect
              doctype="Account"
              filters={{ company: formCompany, is_group: 0 }}
              placeholder="搜索库存会计科目"
            />
          </Form.Item>
          <Form.Item label="默认在途仓库" name="defaultInTransitWarehouse">
            <RemoteLinkSelect
              doctype="Warehouse"
              filters={{ company: formCompany, disabled: 0, is_group: 0 }}
              placeholder="搜索在途仓库"
            />
          </Form.Item>
          <Form.Item label="客户归属" name="customer">
            <RemoteLinkSelect doctype="Customer" placeholder="搜索客户" />
          </Form.Item>
          <Space size={32}>
            <Form.Item label="分组仓库" name="isGroup" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              label="拒收仓"
              name="isRejectedWarehouse"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item label="停用" name="disabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item label="电话" name="phoneNo" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item label="手机" name="mobileNo" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item label="邮箱" name="emailId">
            <Input />
          </Form.Item>
          <Form.Item label="地址 1" name="addressLine1">
            <Input placeholder="仓库地址" />
          </Form.Item>
          <Form.Item label="地址 2" name="addressLine2">
            <Input placeholder="补充地址" />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item label="城市" name="city" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item label="省/州" name="state" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item label="邮编" name="pin" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default WarehousesPage;
