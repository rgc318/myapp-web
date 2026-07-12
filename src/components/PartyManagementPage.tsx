import {
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  PageContainer,
  ProDescriptions,
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
  message,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import React, { useRef, useState } from 'react';
import { CurrencySelect } from '@/components/CurrencySelect';
import type { PageResult } from '@/services/myapp/api-utils';
import { toOptionalText } from '@/services/myapp/api-utils';
import type {
  ListOptions,
  PartySummary,
  SavePartyPayload,
} from '@/services/myapp/master-data';

const PAGE_SIZE = 20;
const EXPORT_LIMIT = 1000;

type PartyFormValues = SavePartyPayload;
type PartyListQuery = {
  disabledFilter?: string;
  group?: string;
  searchKey?: string;
};
type PartyImportAction = 'create' | 'update';
type PartyImportStatus = 'pending' | 'success' | 'error';
type PartyImportRowBase = {
  action: PartyImportAction;
  error?: string;
  line: number;
  name?: string | null;
  partyName: string;
  status: PartyImportStatus;
};
type PartyImportRow =
  | (PartyImportRowBase & {
      action: 'create';
      payload: SavePartyPayload;
    })
  | (PartyImportRowBase & {
      action: 'update';
      payload: Partial<SavePartyPayload>;
    });

type PartyManagementPageProps = {
  createParty: (payload: SavePartyPayload) => Promise<unknown>;
  defaultGroup?: string;
  defaultType?: string;
  getPartyDetail?: (name: string) => Promise<PartySummary | null>;
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

function mapImportAction(value?: string): PartyImportAction {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'update' || normalized === '更新') {
    return 'update';
  }
  return 'create';
}

function setOptionalPayload<K extends keyof SavePartyPayload>(
  payload: Partial<SavePartyPayload>,
  key: K,
  value: SavePartyPayload[K] | undefined,
) {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function buildImportRows(
  rawRows: Record<string, string>[],
  partyLabel: string,
  defaultGroup?: string,
  defaultType = 'Company',
): PartyImportRow[] {
  return rawRows.map((row) => {
    const action = mapImportAction(readCsvField(row, ['action', '导入动作']));
    const name = readCsvField(row, ['name', `${partyLabel}编码`]);
    const partyName =
      readCsvField(row, ['partyName', 'displayName', `${partyLabel}名称`]) ??
      '';
    const addressLine1 = readCsvField(row, [
      'addressLine1',
      'address_line1',
      '地址1',
      '地址 1',
    ]);
    const addressLine2 = readCsvField(row, [
      'addressLine2',
      'address_line2',
      '地址2',
      '地址 2',
    ]);
    const city = readCsvField(row, ['city', '城市']);
    const contactName = readCsvField(row, ['contactName', '联系人']);
    const country = readCsvField(row, ['country', '国家']);
    const county = readCsvField(row, ['county', '区县']);
    const defaultCurrency = readCsvField(row, ['defaultCurrency', '默认币种']);
    const defaultPriceList = readCsvField(row, [
      'defaultPriceList',
      'default_price_list',
      '默认价格表',
    ]);
    const disabled = readCsvDisabled(row, ['disabled', '停用', '状态']);
    const email = readCsvField(row, ['email', '邮箱']);
    const group = readCsvField(row, ['group', '分组']);
    const mobileNo = readCsvField(row, ['mobileNo', '手机']);
    const paymentTerms = readCsvField(row, [
      'paymentTerms',
      'payment_terms',
      '付款条款',
    ]);
    const pincode = readCsvField(row, ['pincode', '邮编']);
    const remarks = readCsvField(row, ['remarks', '备注']);
    const state = readCsvField(row, ['state', '省/州']);
    const taxCategory = readCsvField(row, [
      'taxCategory',
      'tax_category',
      '税务类别',
    ]);
    const taxId = readCsvField(row, ['taxId', 'tax_id', '税号']);
    const type = readCsvField(row, ['type', '类型']);

    if (action === 'update') {
      const payload: Partial<SavePartyPayload> = {};
      setOptionalPayload(payload, 'addressLine1', addressLine1);
      setOptionalPayload(payload, 'addressLine2', addressLine2);
      setOptionalPayload(payload, 'city', city);
      setOptionalPayload(payload, 'contactName', contactName);
      setOptionalPayload(payload, 'country', country);
      setOptionalPayload(payload, 'county', county);
      setOptionalPayload(payload, 'defaultCurrency', defaultCurrency);
      setOptionalPayload(payload, 'defaultPriceList', defaultPriceList);
      setOptionalPayload(payload, 'email', email);
      setOptionalPayload(payload, 'group', group);
      setOptionalPayload(payload, 'mobileNo', mobileNo);
      setOptionalPayload(payload, 'name', partyName || undefined);
      setOptionalPayload(payload, 'paymentTerms', paymentTerms);
      setOptionalPayload(payload, 'pincode', pincode);
      setOptionalPayload(payload, 'remarks', remarks);
      setOptionalPayload(payload, 'state', state);
      setOptionalPayload(payload, 'taxCategory', taxCategory);
      setOptionalPayload(payload, 'taxId', taxId);
      setOptionalPayload(payload, 'type', type);
      if (disabled !== undefined) {
        payload.disabled = disabled;
      }
      const error = !name
        ? `更新${partyLabel}必须填写${partyLabel}编码`
        : Object.keys(payload).length === 0
          ? `更新${partyLabel}必须至少填写一个更新字段`
          : undefined;
      return {
        action,
        error,
        line: Number(row.__line ?? 0),
        name,
        partyName,
        payload,
        status: error ? 'error' : 'pending',
      };
    }

    const payload: SavePartyPayload = {
      addressLine1: addressLine1 ?? null,
      addressLine2: addressLine2 ?? null,
      city: city ?? null,
      contactName: contactName ?? null,
      country: country ?? null,
      county: county ?? null,
      defaultCurrency: defaultCurrency ?? null,
      defaultPriceList: defaultPriceList ?? null,
      disabled: disabled ?? false,
      email: email ?? null,
      group: group ?? defaultGroup ?? null,
      mobileNo: mobileNo ?? null,
      name: partyName,
      paymentTerms: paymentTerms ?? null,
      pincode: pincode ?? null,
      remarks: remarks ?? null,
      state: state ?? null,
      taxCategory: taxCategory ?? null,
      taxId: taxId ?? null,
      type: type ?? defaultType,
    };
    const error = !partyName
      ? `新增${partyLabel}必须填写${partyLabel}名称`
      : undefined;
    return {
      action,
      error,
      line: Number(row.__line ?? 0),
      name,
      partyName,
      payload,
      status: error ? 'error' : 'pending',
    };
  });
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

function buildListOptions(
  params: PartyListQuery,
  pageSize: number,
  current: number,
) {
  const disabledFilter = String(params.disabledFilter ?? 'all');
  return {
    disabled:
      disabledFilter === 'enabled'
        ? (0 as const)
        : disabledFilter === 'disabled'
          ? (1 as const)
          : undefined,
    group: toOptionalText(params.group),
    limit: pageSize,
    searchKey: String(params.searchKey ?? ''),
    start: (current - 1) * pageSize,
  };
}

function normalizeListQuery(params: Record<string, unknown>): PartyListQuery {
  return {
    disabledFilter: String(params.disabledFilter ?? 'all'),
    group: toOptionalText(params.group) ?? undefined,
    searchKey: String(params.searchKey ?? ''),
  };
}

function getAddressText(record: PartySummary) {
  return [
    record.defaultAddress?.addressLine1,
    record.defaultAddress?.addressLine2,
    record.defaultAddress?.city,
    record.defaultAddress?.state,
    record.defaultAddress?.country,
  ]
    .filter(Boolean)
    .join(' / ');
}

const PartyManagementPage: React.FC<PartyManagementPageProps> = ({
  createParty,
  defaultGroup,
  defaultType = 'Company',
  getPartyDetail,
  listParties,
  partyLabel,
  searchPlaceholder,
  setPartyDisabled,
  updateParty,
}) => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<PartyFormValues>();
  const [detail, setDetail] = useState<PartySummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingParty, setEditingParty] = useState<PartySummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<PartyImportRow[]>([]);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [lastQuery, setLastQuery] = useState<PartyListQuery>({
    disabledFilter: 'all',
    group: undefined,
    searchKey: '',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingParty, setTogglingParty] = useState<string>();
  const validImportRows = importRows.filter((row) => !row.error);
  const defaultPriceListExample =
    partyLabel === '供应商' ? 'Standard Buying' : 'Standard Selling';

  const reload = () => actionRef.current?.reload();

  const setFormFromParty = (record: PartySummary) => {
    form.setFieldsValue({
      addressLine1: record.defaultAddress?.addressLine1,
      addressLine2: record.defaultAddress?.addressLine2,
      city: record.defaultAddress?.city,
      contactName: record.defaultContact?.displayName,
      country: record.defaultAddress?.country,
      county: record.defaultAddress?.county,
      defaultCurrency: record.defaultCurrency,
      defaultPriceList: record.defaultPriceList,
      disabled: record.disabled,
      email: record.email,
      group: record.group,
      mobileNo: record.mobileNo,
      name: record.displayName || record.name,
      paymentTerms: record.paymentTerms,
      pincode: record.defaultAddress?.pincode,
      remarks: record.remarks,
      state: record.defaultAddress?.state,
      taxCategory: record.taxCategory,
      taxId: record.taxId,
      type: record.type,
    });
  };

  const openCreateModal = () => {
    setEditingParty(null);
    form.resetFields();
    form.setFieldsValue({
      country: 'China',
      disabled: false,
      group: defaultGroup,
      type: defaultType,
    });
    setModalOpen(true);
  };

  const openEditModal = (record: PartySummary) => {
    setEditingParty(record);
    setFormFromParty(record);
    setModalOpen(true);
  };

  const openDetail = async (record: PartySummary) => {
    setDetail(record);
    setDetailOpen(true);
    if (!getPartyDetail) {
      return;
    }
    setDetailLoading(true);
    try {
      const nextDetail = await getPartyDetail(record.name);
      if (nextDetail) {
        setDetail(nextDetail);
      }
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: PartyFormValues) => {
    setSubmitting(true);
    try {
      if (editingParty) {
        await updateParty(editingParty.name, values);
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await listParties({
        ...buildListOptions(lastQuery, EXPORT_LIMIT, 1),
        limit: EXPORT_LIMIT,
        start: 0,
      });
      downloadCsv(`${partyLabel}-export.csv`, [
        [
          `${partyLabel}编码`,
          `${partyLabel}名称`,
          '类型',
          '分组',
          '状态',
          '默认币种',
          '默认价格表',
          '付款条款',
          '税务类别',
          '税号',
          '联系人',
          '手机',
          '邮箱',
          '地址 1',
          '地址 2',
          '城市',
          '省/州',
          '国家',
          '邮编',
          '备注',
        ],
        ...result.items.map((party) => [
          party.name,
          party.displayName,
          party.type ?? '',
          party.group ?? '',
          party.disabled ? '停用' : '启用',
          party.defaultCurrency ?? '',
          party.defaultPriceList ?? '',
          party.paymentTerms ?? '',
          party.taxCategory ?? '',
          party.taxId ?? '',
          party.defaultContact?.displayName ?? '',
          party.mobileNo ?? '',
          party.email ?? '',
          party.defaultAddress?.addressLine1 ?? '',
          party.defaultAddress?.addressLine2 ?? '',
          party.defaultAddress?.city ?? '',
          party.defaultAddress?.state ?? '',
          party.defaultAddress?.country ?? '',
          party.defaultAddress?.pincode ?? '',
          party.remarks ?? '',
        ]),
      ]);
      message.success(`已导出 ${result.items.length} 条${partyLabel}`);
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const downloadImportTemplate = () => {
    downloadCsv(`${partyLabel}-import-template.csv`, [
      [
        '导入动作',
        `${partyLabel}编码`,
        `${partyLabel}名称`,
        '类型',
        '分组',
        '停用',
        '默认币种',
        '默认价格表',
        '付款条款',
        '税务类别',
        '税号',
        '联系人',
        '手机',
        '邮箱',
        '地址 1',
        '地址 2',
        '城市',
        '省/州',
        '国家',
        '邮编',
        '备注',
      ],
      [
        'create',
        '',
        `示例${partyLabel}`,
        defaultType,
        defaultGroup ?? '',
        '0',
        'CNY',
        defaultPriceListExample,
        '',
        '',
        '',
        `示例${partyLabel}联系人`,
        '13800000000',
        'party@example.test',
        '示例地址',
        '',
        'Shanghai',
        'Shanghai',
        'China',
        '200000',
        '示例备注',
      ],
      [
        'update',
        `${partyLabel}-0001`,
        `示例${partyLabel}-更新`,
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
      const rows = buildImportRows(
        parseCsv(text),
        partyLabel,
        defaultGroup,
        defaultType,
      );
      setImportRows(rows);
      setImportModalOpen(true);
      if (!rows.length) {
        message.warning(`未读取到可导入的${partyLabel}行`);
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
            await updateParty(String(row.name), row.payload);
          } else {
            await createParty(row.payload);
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
      title: '分组',
      dataIndex: 'group',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: `${partyLabel}分组`,
      },
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
      width: 220,
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
      width: 150,
      renderText: (value) => value || '-',
    },
    {
      title: '付款条款',
      dataIndex: 'paymentTerms',
      search: false,
      ellipsis: true,
      width: 150,
      renderText: (value) => value || '-',
    },
    {
      title: '税号',
      dataIndex: 'taxId',
      search: false,
      ellipsis: true,
      width: 160,
      renderText: (value) => value || '-',
    },
    {
      title: '联系人',
      dataIndex: ['defaultContact', 'displayName'],
      search: false,
      width: 140,
      renderText: (_, record) => record.defaultContact?.displayName || '-',
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
      width: 190,
      renderText: (value) => value || '-',
    },
    {
      title: '地址',
      dataIndex: ['defaultAddress', 'addressLine1'],
      search: false,
      ellipsis: true,
      renderText: (_, record) => getAddressText(record) || '-',
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
      width: 190,
      fixed: 'right',
      render: (_, record) => [
        <Button key="detail" type="link" onClick={() => openDetail(record)}>
          详情
        </Button>,
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
        <Button
          icon={<PlusOutlined />}
          key="create"
          type="primary"
          onClick={openCreateModal}
        >
          新增{partyLabel}
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
          const query = normalizeListQuery(params);
          setLastQuery(query);
          const result = await listParties(
            buildListOptions(query, pageSize, current),
          );

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey="name"
        scroll={{ x: 1660 }}
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
        title={`批量导入${partyLabel}`}
        width={1040}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            message={`CSV 导入按行执行；导入动作为 create 时创建${partyLabel}，为 update 时按${partyLabel}编码更新。`}
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
          <ProTable<PartyImportRow>
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
                title: `${partyLabel}编码`,
                dataIndex: 'name',
                ellipsis: true,
                width: 160,
                renderText: (value) => value || '-',
              },
              {
                title: `${partyLabel}名称`,
                dataIndex: 'partyName',
                ellipsis: true,
              },
              {
                title: '分组',
                renderText: (_, record) => record.payload.group || '-',
                width: 150,
              },
              {
                title: '联系人',
                renderText: (_, record) => record.payload.contactName || '-',
                width: 140,
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
              `${record.line}:${record.name ?? record.partyName}`
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
          editingParty
            ? `编辑${partyLabel} ${editingParty.name}`
            : `新增${partyLabel}`
        }
        width={720}
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
            <Form.Item label="类型" name="type" style={{ flex: 1 }}>
              <Select options={partyTypeOptions} />
            </Form.Item>
            <Form.Item label="分组" name="group" style={{ flex: 1 }}>
              <Input placeholder={`${partyLabel}分组`} />
            </Form.Item>
            <Form.Item
              label="默认币种"
              name="defaultCurrency"
              style={{ flex: 1 }}
            >
              <CurrencySelect placeholder="选择默认币种" />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="默认价格表"
              name="defaultPriceList"
              style={{ flex: 1 }}
            >
              <Input placeholder="价格表" />
            </Form.Item>
            <Form.Item label="付款条款" name="paymentTerms" style={{ flex: 1 }}>
              <Input placeholder="付款条款模板" />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item label="税务类别" name="taxCategory" style={{ flex: 1 }}>
              <Input placeholder="税务类别" />
            </Form.Item>
            <Form.Item label="税号" name="taxId" style={{ flex: 1 }}>
              <Input placeholder="税务登记号" />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item label="联系人" name="contactName" style={{ flex: 1 }}>
              <Input placeholder="主联系人" />
            </Form.Item>
            <Form.Item label="手机" name="mobileNo" style={{ flex: 1 }}>
              <Input placeholder="手机" />
            </Form.Item>
            <Form.Item label="邮箱" name="email" style={{ flex: 1 }}>
              <Input placeholder="邮箱" />
            </Form.Item>
          </Space>
          <Form.Item label="地址 1" name="addressLine1">
            <Input placeholder={`${partyLabel}主地址`} />
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
            <Form.Item label="国家" name="country" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item label="区县" name="county" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item label="邮编" name="pincode" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
          </Form.Item>
          <Form.Item label="停用" name="disabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        destroyOnHidden
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        open={detailOpen}
        title={
          detail ? `${partyLabel}详情 ${detail.name}` : `${partyLabel}详情`
        }
        width={720}
        extra={
          detail ? (
            <Button
              icon={<EyeOutlined />}
              onClick={() => openEditModal(detail)}
            >
              编辑
            </Button>
          ) : null
        }
      >
        {detail ? (
          <Tabs
            items={[
              {
                key: 'profile',
                label: '资料',
                children: (
                  <ProDescriptions<PartySummary>
                    column={2}
                    dataSource={detail}
                    columns={[
                      {
                        title: `${partyLabel}编码`,
                        dataIndex: 'name',
                      },
                      {
                        title: `${partyLabel}名称`,
                        dataIndex: 'displayName',
                      },
                      {
                        title: '类型',
                        dataIndex: 'type',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '分组',
                        dataIndex: 'group',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '默认币种',
                        dataIndex: 'defaultCurrency',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '默认价格表',
                        dataIndex: 'defaultPriceList',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '付款条款',
                        dataIndex: 'paymentTerms',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '税务类别',
                        dataIndex: 'taxCategory',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '税号',
                        dataIndex: 'taxId',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '状态',
                        render: (_, record) =>
                          record.disabled ? (
                            <Tag>停用</Tag>
                          ) : (
                            <Tag color="green">启用</Tag>
                          ),
                      },
                      {
                        title: '创建时间',
                        dataIndex: 'creation',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '更新时间',
                        dataIndex: 'modified',
                        renderText: (value) => value || '-',
                      },
                      {
                        title: '备注',
                        dataIndex: 'remarks',
                        span: 2,
                        renderText: (value) => value || '-',
                      },
                    ]}
                  />
                ),
              },
              {
                key: 'contact',
                label: '联系人与地址',
                children: (
                  <Space
                    orientation="vertical"
                    size={16}
                    style={{ width: '100%' }}
                  >
                    <Descriptions
                      bordered
                      column={1}
                      items={[
                        {
                          key: 'contact',
                          label: '主联系人',
                          children: detail.defaultContact?.displayName || '-',
                        },
                        {
                          key: 'phone',
                          label: '手机/电话',
                          children: detail.mobileNo || '-',
                        },
                        {
                          key: 'email',
                          label: '邮箱',
                          children: detail.email || '-',
                        },
                      ]}
                      size="small"
                    />
                    <Descriptions
                      bordered
                      column={1}
                      items={[
                        {
                          key: 'address',
                          label: '主地址',
                          children: getAddressText(detail) || '-',
                        },
                        {
                          key: 'pincode',
                          label: '邮编',
                          children: detail.defaultAddress?.pincode || '-',
                        },
                      ]}
                      size="small"
                    />
                    <ProTable
                      columns={[
                        {
                          title: '最近使用地址',
                          dataIndex: 'addressDisplay',
                          ellipsis: true,
                          renderText: (value) => value || '-',
                        },
                        {
                          title: '地址记录',
                          dataIndex: 'name',
                          width: 180,
                          renderText: (value) => value || '-',
                        },
                      ]}
                      dataSource={detail.recentAddresses}
                      pagination={false}
                      rowKey={(record) =>
                        `${record.name ?? ''}:${record.addressDisplay ?? ''}`
                      }
                      search={false}
                      size="small"
                      toolBarRender={false}
                    />
                  </Space>
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>
    </PageContainer>
  );
};

export default PartyManagementPage;
