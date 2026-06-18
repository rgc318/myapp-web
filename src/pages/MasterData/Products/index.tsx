import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Space,
  Switch,
  Tag,
} from 'antd';
import React, { useRef, useState } from 'react';
import { ItemImageUpload } from '@/components/ItemImageUpload';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import { UomSelect } from '@/components/UomSelect';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  createProduct,
  listProducts,
  type ProductSummary,
  type SaveProductPayload,
  setProductDisabled,
  updateProduct,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';

const PAGE_SIZE = 20;

type ProductFormValues = SaveProductPayload;

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function buildColumns({
  defaultCompany,
  onEdit,
  onToggleDisabled,
  togglingProduct,
}: {
  defaultCompany: string;
  onEdit: (record: ProductSummary) => void;
  onToggleDisabled: (record: ProductSummary) => void;
  togglingProduct?: string;
}): ProColumns<ProductSummary>[] {
  return [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '商品编码 / 名称 / 条码',
      },
    },
    {
      title: '公司',
      dataIndex: 'company',
      hideInTable: true,
      initialValue: defaultCompany,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Company"
          onChange={(nextValue) => {
            const company = toOptionalText(nextValue);
            form.setFieldValue?.('company', company);
            onChange?.(company);
          }}
          placeholder="搜索公司"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('company'))
          }
        />
      ),
    },
    {
      title: '仓库',
      dataIndex: 'warehouseFilter',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '仓库',
      },
    },
    {
      title: '状态',
      dataIndex: 'disabledFilter',
      hideInTable: true,
      initialValue: 'enabled',
      valueEnum: {
        all: { text: '全部' },
        enabled: { text: '启用' },
        disabled: { text: '停用' },
      },
    },
    {
      title: '图片',
      dataIndex: 'imageUrl',
      search: false,
      width: 80,
      render: (_, record) =>
        record.imageUrl ? (
          <Image height={48} src={record.imageUrl} width={48} />
        ) : (
          '-'
        ),
    },
    {
      title: '商品编码',
      dataIndex: 'itemCode',
      search: false,
      width: 160,
    },
    {
      title: '商品名称',
      dataIndex: 'itemName',
      search: false,
      ellipsis: true,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      search: false,
      ellipsis: true,
      width: 160,
      renderText: (value) => value || '-',
    },
    {
      title: '库存',
      dataIndex: 'stockQty',
      align: 'right',
      search: false,
      width: 110,
      render: (_, record) => formatNumber(record.stockQty),
    },
    {
      title: '单位',
      dataIndex: 'stockUom',
      search: false,
      width: 100,
      render: (_, record) =>
        resolveDisplayUom(record.stockUom, record.stockUomDisplay),
    },
    {
      title: '价格',
      dataIndex: 'price',
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) => formatCurrencyValue(record.price),
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
        <Button key="edit" type="link" onClick={() => onEdit(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="toggle"
          cancelText="取消"
          okText={record.disabled ? '启用' : '停用'}
          onConfirm={() => onToggleDisabled(record)}
          title={`${record.disabled ? '启用' : '停用'}商品 ${record.itemName || record.itemCode}？`}
        >
          <Button
            danger={!record.disabled}
            loading={togglingProduct === record.itemCode}
            type="link"
          >
            {record.disabled ? '启用' : '停用'}
          </Button>
        </Popconfirm>,
      ],
    },
  ];
}

const ProductsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<ProductFormValues>();
  const { defaultCompany } = useWorkspacePreferences();
  const [editingProduct, setEditingProduct] = useState<ProductSummary | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingProduct, setTogglingProduct] = useState<string>();
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>();

  const reload = () => actionRef.current?.reload();

  const openCreateModal = () => {
    setEditingProduct(null);
    setUploadedImageUrl(undefined);
    form.resetFields();
    form.setFieldsValue({
      currency: 'CNY',
      disabled: false,
      stockUom: 'Nos',
    });
    setModalOpen(true);
  };

  const openEditModal = (record: ProductSummary) => {
    setEditingProduct(record);
    setUploadedImageUrl(undefined);
    form.setFieldsValue({
      barcode: record.barcode,
      brand: record.brand,
      currency: 'CNY',
      description: record.description,
      disabled: record.disabled,
      itemGroup: record.itemGroup,
      itemName: record.itemName,
      retailDefaultUom: record.retailDefaultUom ?? record.stockUom,
      standardBuyingRate: record.priceSummary?.standardBuyingRate ?? undefined,
      standardSellingRate:
        record.priceSummary?.standardSellingRate ??
        record.priceSummary?.currentRate ??
        undefined,
      stockUom: record.stockUom,
      valuationRate: record.priceSummary?.valuationRate ?? undefined,
      wholesaleDefaultUom: record.wholesaleDefaultUom ?? record.stockUom,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: ProductFormValues) => {
    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.itemCode, values);
      } else {
        await createProduct({
          ...values,
          image: uploadedImageUrl,
        });
      }
      setModalOpen(false);
      setUploadedImageUrl(undefined);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisabled = async (record: ProductSummary) => {
    setTogglingProduct(record.itemCode);
    try {
      await setProductDisabled(record.itemCode, !record.disabled);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setTogglingProduct(undefined);
    }
  };

  const columns = buildColumns({
    defaultCompany,
    onEdit: openEditModal,
    onToggleDisabled: handleToggleDisabled,
    togglingProduct,
  });

  return (
    <PageContainer
      title="商品"
      extra={[
        <Button key="create" type="primary" onClick={openCreateModal}>
          新增商品
        </Button>,
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<ProductSummary>
        actionRef={actionRef}
        columns={columns}
        key={defaultCompany}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const disabledFilter = String(params.disabledFilter ?? 'enabled');
          const result = await listProducts({
            company: toOptionalText(params.company),
            disabled:
              disabledFilter === 'enabled'
                ? 0
                : disabledFilter === 'disabled'
                  ? 1
                  : undefined,
            limit: pageSize,
            searchKey: String(params.searchKey ?? ''),
            start: (current - 1) * pageSize,
            warehouse: String(params.warehouseFilter ?? ''),
          });

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey="itemCode"
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
          editingProduct ? `编辑商品 ${editingProduct.itemCode}` : '新增商品'
        }
        width={720}
      >
        <Form<ProductFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item label="商品图片">
            <ItemImageUpload
              itemCode={editingProduct?.itemCode}
              onChange={(fileUrl) => {
                setUploadedImageUrl(fileUrl || undefined);
              }}
              value={editingProduct?.imageUrl}
            />
          </Form.Item>
          {!editingProduct && (
            <Form.Item label="商品编码" name="itemCode">
              <Input placeholder="不填则后端自动生成" />
            </Form.Item>
          )}
          <Form.Item
            label="商品名称"
            name="itemName"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="商品名称" />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="商品分类"
              name="itemGroup"
              style={{ minWidth: 220 }}
            >
              <Input placeholder="例如 All Item Groups" />
            </Form.Item>
            <Form.Item label="品牌" name="brand" style={{ minWidth: 180 }}>
              <Input placeholder="品牌" />
            </Form.Item>
            <Form.Item label="条码" name="barcode" style={{ minWidth: 200 }}>
              <Input placeholder="主条码" />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="库存单位"
              name="stockUom"
              rules={[{ required: true, message: '请选择库存单位' }]}
              style={{ minWidth: 200 }}
            >
              <UomSelect />
            </Form.Item>
            <Form.Item
              label="批发默认单位"
              name="wholesaleDefaultUom"
              style={{ minWidth: 200 }}
            >
              <UomSelect />
            </Form.Item>
            <Form.Item
              label="零售默认单位"
              name="retailDefaultUom"
              style={{ minWidth: 200 }}
            >
              <UomSelect />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="标准售价"
              name="standardSellingRate"
              style={{ minWidth: 160 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="标准采购价"
              name="standardBuyingRate"
              style={{ minWidth: 160 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="估值价"
              name="valuationRate"
              style={{ minWidth: 160 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="币种" name="currency" style={{ minWidth: 120 }}>
              <Input placeholder="CNY" />
            </Form.Item>
          </Space>
          <Form.Item label="描述" name="description">
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

export default ProductsPage;
