import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  List,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import React from 'react';
import type { AiDraft } from '@/services/myapp/ai';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';

const DRAFT_TYPE_LABELS: Record<AiDraft['draftType'], string> = {
  inventory_adjustment: '库存调整',
  product_setup: '商品建档',
  purchase_order: '采购订单',
  sales_order: '销售订单',
};

const FIELD_LABELS: Record<string, string> = {
  adjustment_type: '调整方式',
  company: '公司',
  customer: '客户',
  default_purchase_mode: '采购模式',
  default_sales_mode: '销售模式',
  delivery_date: '交货日期',
  posting_date: '过账日期',
  reason: '调整原因',
  remarks: '备注',
  schedule_date: '计划到货日期',
  supplier: '供应商',
  transaction_date: '单据日期',
  warehouse: '默认仓库',
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.join('、') || '-';
  return String(value);
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '-';
}

export function AiDraftBusinessReview({ draft }: { draft: AiDraft }) {
  const payload = draft.payload;
  const itemRows = (Array.isArray(payload.items) ? payload.items : []).map(
    (value, index) => ({ ...asObject(value), key: String(index) }),
  );
  const party =
    draft.draftType === 'purchase_order'
      ? payload.supplier
      : draft.draftType === 'sales_order'
        ? payload.customer
        : null;
  const partyLabel =
    draft.draftType === 'purchase_order'
      ? '供应商'
      : draft.draftType === 'sales_order'
        ? '客户'
        : '调整方式';
  const partyValue =
    draft.draftType === 'inventory_adjustment'
      ? payload.adjustment_type
      : party;
  const businessDate =
    payload.posting_date ?? payload.transaction_date ?? payload.schedule_date;

  if (draft.draftType === 'product_setup') {
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions
          bordered
          column={{ lg: 2, md: 2, sm: 1, xs: 1 }}
          size="small"
          items={[
            {
              key: 'type',
              label: '草稿类型',
              children: DRAFT_TYPE_LABELS[draft.draftType],
            },
            {
              key: 'company',
              label: '公司',
              children: displayValue(payload.company ?? draft.company),
            },
            {
              key: 'itemName',
              label: '商品名称',
              children: displayValue(payload.item_name),
            },
            {
              key: 'itemCode',
              label: '商品编码',
              children: displayValue(payload.item_code),
            },
            {
              key: 'itemGroup',
              label: '商品分类',
              children: displayValue(payload.item_group),
            },
            {
              key: 'brand',
              label: '品牌',
              children: displayValue(payload.brand),
            },
            {
              key: 'stockUom',
              label: '库存单位',
              children: resolveDisplayUom(
                typeof payload.stock_uom === 'string'
                  ? payload.stock_uom
                  : null,
                typeof payload.stock_uom_display === 'string'
                  ? payload.stock_uom_display
                  : null,
              ),
            },
            {
              key: 'sellingRate',
              label: '标准售价',
              children: formatCurrencyValue(
                payload.standard_selling_rate as number | string | null,
                typeof payload.currency === 'string' ? payload.currency : 'CNY',
              ),
            },
            {
              key: 'openingStock',
              label: '初始库存',
              children: `${formatNumber(payload.opening_qty)} ${resolveDisplayUom(
                typeof payload.opening_uom === 'string'
                  ? payload.opening_uom
                  : null,
                typeof payload.opening_uom_display === 'string'
                  ? payload.opening_uom_display
                  : null,
              )}`,
            },
            {
              key: 'warehouse',
              label: '入库仓库',
              children: displayValue(payload.warehouse),
            },
            {
              key: 'valuationRate',
              label: '库存估值价',
              children: formatCurrencyValue(
                payload.valuation_rate as number | string | null,
                typeof payload.currency === 'string' ? payload.currency : 'CNY',
              ),
            },
            {
              key: 'description',
              label: '商品描述',
              span: 2,
              children: displayValue(payload.description),
            },
          ]}
        />
        {draft.validation.errors.map((error) => (
          <Alert key={error} showIcon title={error} type="error" />
        ))}
        {draft.validation.warnings.map((warning) => (
          <Alert key={warning} showIcon title={warning} type="warning" />
        ))}
        {!draft.validation.errors.length ? (
          <Alert
            showIcon
            title={
              draft.validation.readyForHandoff
                ? '商品、售价和初始库存草稿已通过校验，可以交接商品页面。'
                : '商品建档草稿尚未满足交接条件。'
            }
            type={draft.validation.readyForHandoff ? 'success' : 'info'}
          />
        ) : null}
      </Space>
    );
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Descriptions
        bordered
        column={{ lg: 2, md: 2, sm: 1, xs: 1 }}
        size="small"
        items={[
          {
            key: 'type',
            label: '草稿类型',
            children: DRAFT_TYPE_LABELS[draft.draftType],
          },
          {
            key: 'company',
            label: '公司',
            children: displayValue(payload.company ?? draft.company),
          },
          {
            key: 'party',
            label: partyLabel,
            children: displayValue(partyValue),
          },
          {
            key: 'date',
            label:
              draft.draftType === 'inventory_adjustment'
                ? '过账日期'
                : '单据日期',
            children: displayValue(businessDate),
          },
          {
            key: 'warehouse',
            label: '默认仓库',
            children: displayValue(payload.warehouse),
          },
          {
            key: 'targetDate',
            label:
              draft.draftType === 'purchase_order'
                ? '计划到货日期'
                : '交货日期',
            children: displayValue(
              payload.schedule_date ?? payload.delivery_date,
            ),
          },
          {
            key: 'remarks',
            label:
              draft.draftType === 'inventory_adjustment' ? '调整原因' : '备注',
            span: 2,
            children: displayValue(payload.reason ?? payload.remarks),
          },
        ]}
      />

      {draft.validation.errors.map((error) => (
        <Alert key={error} showIcon title={error} type="error" />
      ))}
      {draft.validation.warnings.map((warning) => (
        <Alert key={warning} showIcon title={warning} type="warning" />
      ))}
      {!draft.validation.errors.length && !draft.validation.warnings.length ? (
        <Alert
          showIcon
          title={
            draft.validation.readyForHandoff
              ? '草稿已通过后端实时校验，可以交接业务编辑器。'
              : '草稿尚未满足交接条件。'
          }
          type={draft.validation.readyForHandoff ? 'success' : 'info'}
        />
      ) : null}

      <ProCard title="业务明细" variant="outlined">
        {itemRows.length ? (
          <Table
            columns={[
              {
                dataIndex: 'item_code',
                title: '商品',
                render: (_, row) => (
                  <Space orientation="vertical" size={0}>
                    <Typography.Text strong>
                      {displayValue(
                        row.item_name ?? row.item_code ?? row.item_query,
                      )}
                    </Typography.Text>
                    <Typography.Text copyable type="secondary">
                      {displayValue(row.item_code)}
                    </Typography.Text>
                  </Space>
                ),
              },
              draft.draftType === 'inventory_adjustment'
                ? {
                    key: 'stockChange',
                    title: '库存变化',
                    render: (_: unknown, row: Record<string, unknown>) =>
                      `${formatNumber(row.current_stock_qty)} → ${formatNumber(row.target_stock_qty ?? row.qty)}`,
                    width: 160,
                  }
                : {
                    dataIndex: 'qty',
                    title: '数量',
                    render: formatNumber,
                    width: 100,
                  },
              {
                dataIndex: 'uom_display',
                title: '单位',
                render: (_: unknown, row: Record<string, unknown>) =>
                  resolveDisplayUom(
                    typeof row.uom === 'string' ? row.uom : null,
                    typeof row.uom_display === 'string'
                      ? row.uom_display
                      : null,
                  ),
                width: 100,
              },
              {
                dataIndex: 'warehouse',
                title: '仓库',
                render: displayValue,
                width: 180,
              },
              {
                key: 'reference',
                title:
                  draft.draftType === 'inventory_adjustment'
                    ? '估值参考'
                    : '参考价',
                render: (_: unknown, row: Record<string, unknown>) => {
                  const referenceValue =
                    row.valuation_rate ?? row.price ?? row.rate;
                  return formatCurrencyValue(
                    typeof referenceValue === 'number' ||
                      typeof referenceValue === 'string'
                      ? referenceValue
                      : null,
                    typeof payload.currency === 'string'
                      ? payload.currency
                      : 'CNY',
                  );
                },
                width: 120,
              },
            ]}
            dataSource={itemRows}
            pagination={false}
            rowKey="key"
            scroll={{ x: 760 }}
            size="small"
          />
        ) : (
          <Empty
            description="草稿中暂无商品明细"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </ProCard>
    </Space>
  );
}

export function AiDraftVersionList({
  currentVersion,
  onRestore,
  versions,
}: {
  currentVersion: number;
  onRestore?: (version: number) => void;
  versions: Record<string, unknown>[];
}) {
  return (
    <List
      dataSource={versions}
      locale={{ emptyText: '暂无版本快照' }}
      renderItem={(version) => {
        const diff = asObject(version.diff);
        const fieldChanges = Array.isArray(diff.fields) ? diff.fields : [];
        const itemChanges = Array.isArray(diff.items) ? diff.items : [];
        const versionNo = Number(version.version ?? 0);
        return (
          <List.Item
            actions={
              onRestore
                ? [
                    <Button
                      disabled={versionNo === currentVersion}
                      key="restore"
                      onClick={() => onRestore(versionNo)}
                    >
                      恢复为新版本
                    </Button>,
                  ]
                : undefined
            }
          >
            <List.Item.Meta
              title={
                <Space wrap>
                  <Typography.Text strong>版本 {versionNo}</Typography.Text>
                  <Tag>{displayValue(version.change_source)}</Tag>
                  <Typography.Text type="secondary">
                    {displayValue(version.creation)}
                  </Typography.Text>
                </Space>
              }
              description={
                <Space orientation="vertical" size={4}>
                  <Typography.Text>
                    字段变化 {fieldChanges.length} 项，商品行变化{' '}
                    {itemChanges.length} 项
                  </Typography.Text>
                  {fieldChanges.map((value, index) => {
                    const change = asObject(value);
                    const field = String(change.field ?? index);
                    return (
                      <Typography.Text key={field} type="secondary">
                        {FIELD_LABELS[field] ?? field}：
                        {displayValue(change.before)} →{' '}
                        {displayValue(change.after)}
                      </Typography.Text>
                    );
                  })}
                  {itemChanges.map((value) => {
                    const change = asObject(value);
                    const key = String(change.key ?? 'item');
                    const fields = Array.isArray(change.fields)
                      ? change.fields.map(
                          (field) =>
                            FIELD_LABELS[String(field)] ?? String(field),
                        )
                      : [];
                    return (
                      <Typography.Text
                        key={`${key}-${displayValue(change.change)}-${JSON.stringify(fields)}`}
                        type="secondary"
                      >
                        商品 {key}：{displayValue(change.change)}
                        {fields.length ? `（${fields.join('、')}）` : ''}
                      </Typography.Text>
                    );
                  })}
                </Space>
              }
            />
          </List.Item>
        );
      }}
    />
  );
}

export function AiDraftRawPayload({ payload }: { payload: unknown }) {
  return (
    <Typography.Paragraph code copyable>
      {JSON.stringify(payload, null, 2)}
    </Typography.Paragraph>
  );
}
