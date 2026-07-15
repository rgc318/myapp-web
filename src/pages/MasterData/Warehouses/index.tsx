import {
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
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
const EXPORT_LIMIT = 1000;

type WarehouseFormValues = SaveWarehousePayload;
type WarehouseListQuery = {
  company?: string;
  disabledFilter?: string;
  groupFilter?: string;
  searchKey?: string;
};
type WarehouseImportAction = 'create' | 'update';
type WarehouseImportStatus = 'pending' | 'success' | 'error';
type WarehouseImportRowBase = {
  action: WarehouseImportAction;
  error?: string;
  line: number;
  status: WarehouseImportStatus;
  warehouse?: string | null;
  warehouseName: string;
};
type WarehouseImportRow =
  | (WarehouseImportRowBase & {
      action: 'create';
      payload: SaveWarehousePayload;
    })
  | (WarehouseImportRowBase & {
      action: 'update';
      payload: Partial<SaveWarehousePayload>;
    });

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase();
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }
  const headers = splitCsvLine(lines[0]).map(normalizeCsvHeader);
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    return headers.reduce<Record<string, string>>(
      (row, header, cellIndex) => {
        row[header] = cells[cellIndex]?.trim() ?? '';
        return row;
      },
      { __line: String(index + 2) },
    );
  });
}

function readCsvField(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeCsvHeader(key)]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function readCsvBoolean(row: Record<string, string>, keys: string[]) {
  const value = readCsvField(row, keys)?.toLowerCase();
  if (!value) {
    return undefined;
  }
  if (['1', 'true', 'yes', 'y', '是', '启用', 'enabled'].includes(value)) {
    return true;
  }
  if (
    ['0', 'false', 'no', 'n', '否', '停用', '禁用', 'disabled'].includes(value)
  ) {
    return false;
  }
  return undefined;
}

function readCsvDisabled(row: Record<string, string>, keys: string[]) {
  const value = readCsvField(row, keys)?.toLowerCase();
  if (!value) {
    return undefined;
  }
  if (['1', 'true', 'yes', 'y', '停用', '禁用', 'disabled'].includes(value)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', '启用', 'enabled'].includes(value)) {
    return false;
  }
  return undefined;
}

function mapImportAction(value?: string): WarehouseImportAction {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'update' || normalized === '更新') {
    return 'update';
  }
  return 'create';
}

function setOptionalPayload<K extends keyof SaveWarehousePayload>(
  payload: Partial<SaveWarehousePayload>,
  key: K,
  value: SaveWarehousePayload[K] | undefined,
) {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function buildImportRows(
  rawRows: Record<string, string>[],
): WarehouseImportRow[] {
  return rawRows.map((row) => {
    const action = mapImportAction(readCsvField(row, ['action', '导入动作']));
    const warehouse = readCsvField(row, ['warehouse', 'name', '仓库编码']);
    const warehouseName =
      readCsvField(row, ['warehouseName', 'warehouse_name', '仓库名称']) ?? '';
    const company = readCsvField(row, ['company', '公司']);
    const account = readCsvField(row, ['account', '会计科目']);
    const addressLine1 = readCsvField(row, [
      'addressLine1',
      'address_line_1',
      '地址1',
      '地址 1',
    ]);
    const addressLine2 = readCsvField(row, [
      'addressLine2',
      'address_line_2',
      '地址2',
      '地址 2',
    ]);
    const city = readCsvField(row, ['city', '城市']);
    const customer = readCsvField(row, ['customer', '客户归属']);
    const defaultInTransitWarehouse = readCsvField(row, [
      'defaultInTransitWarehouse',
      'default_in_transit_warehouse',
      '默认在途仓库',
    ]);
    const disabled = readCsvDisabled(row, ['disabled', '停用', '状态']);
    const emailId = readCsvField(row, ['emailId', 'email_id', '邮箱']);
    const isGroup = readCsvBoolean(row, ['isGroup', 'is_group', '分组仓库']);
    const isRejectedWarehouse = readCsvBoolean(row, [
      'isRejectedWarehouse',
      'is_rejected_warehouse',
      '拒收仓',
    ]);
    const mobileNo = readCsvField(row, ['mobileNo', 'mobile_no', '手机']);
    const parentWarehouse = readCsvField(row, [
      'parentWarehouse',
      'parent_warehouse',
      '父仓库',
    ]);
    const phoneNo = readCsvField(row, ['phoneNo', 'phone_no', '电话']);
    const pin = readCsvField(row, ['pin', '邮编']);
    const state = readCsvField(row, ['state', '省/州']);
    const warehouseType = readCsvField(row, [
      'warehouseType',
      'warehouse_type',
      '仓库类型',
    ]);

    if (action === 'update') {
      const payload: Partial<SaveWarehousePayload> = {};
      setOptionalPayload(payload, 'account', account);
      setOptionalPayload(payload, 'addressLine1', addressLine1);
      setOptionalPayload(payload, 'addressLine2', addressLine2);
      setOptionalPayload(payload, 'city', city);
      setOptionalPayload(payload, 'company', company);
      setOptionalPayload(payload, 'customer', customer);
      setOptionalPayload(
        payload,
        'defaultInTransitWarehouse',
        defaultInTransitWarehouse,
      );
      setOptionalPayload(payload, 'emailId', emailId);
      setOptionalPayload(payload, 'mobileNo', mobileNo);
      setOptionalPayload(payload, 'parentWarehouse', parentWarehouse);
      setOptionalPayload(payload, 'phoneNo', phoneNo);
      setOptionalPayload(payload, 'pin', pin);
      setOptionalPayload(payload, 'state', state);
      setOptionalPayload(payload, 'warehouseName', warehouseName || undefined);
      setOptionalPayload(payload, 'warehouseType', warehouseType);
      if (disabled !== undefined) {
        payload.disabled = disabled;
      }
      if (isGroup !== undefined) {
        payload.isGroup = isGroup;
      }
      if (isRejectedWarehouse !== undefined) {
        payload.isRejectedWarehouse = isRejectedWarehouse;
      }
      const error = !warehouse
        ? '更新仓库必须填写仓库编码'
        : Object.keys(payload).length === 0
          ? '更新仓库必须至少填写一个更新字段'
          : undefined;
      return {
        action,
        error,
        line: Number(row.__line ?? 0),
        payload,
        status: error ? 'error' : 'pending',
        warehouse,
        warehouseName,
      };
    }

    const payload: SaveWarehousePayload = {
      account: account ?? null,
      addressLine1: addressLine1 ?? null,
      addressLine2: addressLine2 ?? null,
      city: city ?? null,
      company: company ?? '',
      customer: customer ?? null,
      defaultInTransitWarehouse: defaultInTransitWarehouse ?? null,
      disabled: disabled ?? false,
      emailId: emailId ?? null,
      isGroup: isGroup ?? false,
      isRejectedWarehouse: isRejectedWarehouse ?? false,
      mobileNo: mobileNo ?? null,
      parentWarehouse: parentWarehouse ?? null,
      phoneNo: phoneNo ?? null,
      pin: pin ?? null,
      state: state ?? null,
      warehouseName,
      warehouseType: warehouseType ?? null,
    };
    const error = !warehouseName
      ? '新增仓库必须填写仓库名称'
      : !company
        ? '新增仓库必须填写公司'
        : undefined;
    return {
      action,
      error,
      line: Number(row.__line ?? 0),
      payload,
      status: error ? 'error' : 'pending',
      warehouse,
      warehouseName,
    };
  });
}

function buildWarehouseListOptions(
  params: WarehouseListQuery,
  pageSize: number,
  current: number,
) {
  const disabledFilter = String(params.disabledFilter ?? 'active');
  const groupFilter = String(params.groupFilter ?? 'all');

  return {
    company: toOptionalText(params.company),
    disabled:
      disabledFilter === 'active'
        ? (0 as const)
        : disabledFilter === 'disabled'
          ? (1 as const)
          : undefined,
    isGroup:
      groupFilter === 'group'
        ? (1 as const)
        : groupFilter === 'leaf'
          ? (0 as const)
          : ('all' as const),
    limit: pageSize,
    searchKey: String(params.searchKey ?? ''),
    start: (current - 1) * pageSize,
  };
}

function normalizeWarehouseListQuery(
  params: Record<string, unknown>,
): WarehouseListQuery {
  return {
    company: toOptionalText(params.company) ?? undefined,
    disabledFilter: String(params.disabledFilter ?? 'active'),
    groupFilter: String(params.groupFilter ?? 'all'),
    searchKey: String(params.searchKey ?? ''),
  };
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const WarehousesPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<WarehouseFormValues>();
  const { defaultCompany } = useWorkspacePreferences();
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<WarehouseImportRow[]>([]);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [lastQuery, setLastQuery] = useState<WarehouseListQuery>({
    disabledFilter: 'active',
    groupFilter: 'all',
    searchKey: '',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingWarehouse, setTogglingWarehouse] = useState<string>();
  const formCompany = Form.useWatch('company', form);
  const validImportRows = importRows.filter((row) => !row.error);

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

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await listWarehouses({
        ...buildWarehouseListOptions(lastQuery, EXPORT_LIMIT, 1),
        limit: EXPORT_LIMIT,
        start: 0,
      });
      downloadCsv('warehouses.csv', [
        [
          '仓库编码',
          '仓库名称',
          '公司',
          '父仓库',
          '分组仓库',
          '状态',
          '仓库类型',
          '会计科目',
          '默认在途仓库',
          '拒收仓',
          '客户归属',
          '电话',
          '手机',
          '邮箱',
          '地址 1',
          '地址 2',
          '城市',
          '省/州',
          '邮编',
        ],
        ...result.items.map((warehouse) => [
          warehouse.name,
          warehouse.warehouseName,
          warehouse.company,
          warehouse.parentWarehouse ?? '',
          warehouse.isGroup ? '1' : '0',
          warehouse.disabled ? '停用' : '启用',
          warehouse.warehouseType ?? '',
          warehouse.account ?? '',
          warehouse.defaultInTransitWarehouse ?? '',
          warehouse.isRejectedWarehouse ? '1' : '0',
          warehouse.customer ?? '',
          warehouse.phoneNo ?? '',
          warehouse.mobileNo ?? '',
          warehouse.emailId ?? '',
          warehouse.addressLine1 ?? '',
          warehouse.addressLine2 ?? '',
          warehouse.city ?? '',
          warehouse.state ?? '',
          warehouse.pin ?? '',
        ]),
      ]);
      message.success(`已导出 ${result.items.length} 条仓库`);
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const downloadImportTemplate = () => {
    downloadCsv('warehouses-import-template.csv', [
      [
        '导入动作',
        '仓库编码',
        '仓库名称',
        '公司',
        '父仓库',
        '分组仓库',
        '停用',
        '仓库类型',
        '会计科目',
        '默认在途仓库',
        '拒收仓',
        '客户归属',
        '电话',
        '手机',
        '邮箱',
        '地址 1',
        '地址 2',
        '城市',
        '省/州',
        '邮编',
      ],
      [
        'create',
        '',
        '示例仓库',
        defaultCompany || 'rgc (Demo)',
        'All Warehouses - RD',
        '0',
        '0',
        'Stores',
        'Stock In Hand - RD',
        '',
        '0',
        '',
        '021-12345678',
        '13800000000',
        'store@example.test',
        '示例地址',
        '',
        'Shanghai',
        'Shanghai',
        '200000',
      ],
      [
        'update',
        'Stores - RD',
        '示例仓库-更新',
        '',
        '',
        '',
        '',
        'Stores',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    ]);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const rows = buildImportRows(parseCsv(text));
      setImportRows(rows);
      setImportModalOpen(true);
      if (!rows.length) {
        message.warning('未读取到可导入的仓库行');
      }
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '读取 CSV 失败');
    }
    return Upload.LIST_IGNORE;
  };

  const handleRunImport = async () => {
    if (!validImportRows.length) {
      message.warning('没有可执行的导入行');
      return;
    }
    setImportSubmitting(true);
    const nextRows = [...importRows];
    try {
      for (const row of nextRows) {
        if (row.error) {
          continue;
        }
        try {
          if (row.action === 'update') {
            await updateWarehouse(String(row.warehouse), row.payload);
          } else {
            await createWarehouse(row.payload);
          }
          row.status = 'success';
          row.error = undefined;
        } catch (caught) {
          row.status = 'error';
          row.error = caught instanceof Error ? caught.message : '导入失败';
        }
        setImportRows([...nextRows]);
      }
      const successCount = nextRows.filter(
        (row) => row.status === 'success',
      ).length;
      const errorCount = nextRows.filter(
        (row) => row.status === 'error',
      ).length;
      message.success(
        `导入完成：成功 ${successCount} 行，失败 ${errorCount} 行`,
      );
      reload();
    } finally {
      setImportSubmitting(false);
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
        <Space orientation="vertical" size={0}>
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
        <Button
          icon={<PlusOutlined />}
          key="create"
          type="primary"
          onClick={openCreateModal}
        >
          新增仓库
        </Button>,
        <Upload
          accept=".csv,text/csv"
          beforeUpload={handleImportFile}
          key="import"
          maxCount={1}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>导入</Button>
        </Upload>,
        <Button
          icon={<DownloadOutlined />}
          key="export"
          loading={exporting}
          onClick={handleExport}
        >
          导出
        </Button>,
        <Button
          icon={<ReloadOutlined />}
          key="refresh"
          onClick={() => actionRef.current?.reload()}
        >
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
          const query = normalizeWarehouseListQuery(params);
          setLastQuery(query);
          const result = await listWarehouses(
            buildWarehouseListOptions(query, pageSize, current),
          );

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
        cancelText="关闭"
        confirmLoading={importSubmitting}
        destroyOnHidden
        okButtonProps={{
          disabled: !validImportRows.length,
        }}
        okText="开始导入"
        onCancel={() => setImportModalOpen(false)}
        onOk={handleRunImport}
        open={importModalOpen}
        title="批量导入仓库"
        width={1040}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            message="CSV 导入按行执行；导入动作为 create 时创建仓库，为 update 时按仓库编码更新仓库。"
            showIcon
            type="info"
          />
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadImportTemplate}
            >
              下载模板
            </Button>
            <Typography.Text type="secondary">
              已读取 {importRows.length} 行，可执行 {validImportRows.length} 行
            </Typography.Text>
          </Space>
          <ProTable<WarehouseImportRow>
            columns={[
              {
                title: '行号',
                dataIndex: 'line',
                width: 72,
              },
              {
                title: '动作',
                dataIndex: 'action',
                width: 88,
                render: (_, record) =>
                  record.action === 'update' ? (
                    <Tag color="blue">更新</Tag>
                  ) : (
                    <Tag color="green">新增</Tag>
                  ),
              },
              {
                title: '仓库编码',
                dataIndex: 'warehouse',
                ellipsis: true,
                width: 160,
                renderText: (value) => value || '-',
              },
              {
                title: '仓库名称',
                dataIndex: 'warehouseName',
                ellipsis: true,
              },
              {
                title: '公司',
                renderText: (_, record) => record.payload.company || '-',
                width: 180,
              },
              {
                title: '父仓库',
                renderText: (_, record) =>
                  record.payload.parentWarehouse || '-',
                width: 180,
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: (_, record) => {
                  if (record.status === 'success') {
                    return <Tag color="green">成功</Tag>;
                  }
                  if (record.status === 'error') {
                    return <Tag color="red">失败</Tag>;
                  }
                  return <Tag>待导入</Tag>;
                },
              },
              {
                title: '提示',
                dataIndex: 'error',
                ellipsis: true,
                renderText: (value) => value || '-',
              },
            ]}
            dataSource={importRows}
            pagination={{ defaultPageSize: 8, showSizeChanger: false }}
            rowKey={(record) =>
              `${record.line}:${record.warehouse ?? record.warehouseName}`
            }
            search={false}
            size="small"
            toolBarRender={false}
          />
        </Space>
      </Modal>
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
