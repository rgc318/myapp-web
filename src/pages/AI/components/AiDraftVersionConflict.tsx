import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import type { AiDraftConflictField } from './ai-draft-form';

function changeTag(field: AiDraftConflictField) {
  if (field.localChanged && field.latestChanged) {
    return <Tag color="red">双方均修改</Tag>;
  }
  if (field.localChanged) return <Tag color="blue">仅我的修改</Tag>;
  return <Tag color="gold">仅最新版本修改</Tag>;
}

function valueCell(value: string) {
  return (
    <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
      {value}
    </Typography.Paragraph>
  );
}

const columns: ColumnsType<AiDraftConflictField> = [
  { dataIndex: 'label', fixed: 'left', title: '字段', width: 150 },
  {
    dataIndex: 'baseDisplay',
    render: valueCell,
    title: '原打开版本',
    width: 220,
  },
  {
    dataIndex: 'localDisplay',
    render: valueCell,
    title: '我的输入',
    width: 220,
  },
  {
    dataIndex: 'latestDisplay',
    render: valueCell,
    title: '最新持久版本',
    width: 220,
  },
  {
    render: (_, field) => changeTag(field),
    title: '变化范围',
    width: 130,
  },
];

export function AiDraftVersionConflict({
  baseVersion,
  canKeepLocal,
  differences,
  latestVersion,
  onApplySelection,
  onSelectedKeysChange,
  onUseLatest,
  selectedKeys,
}: {
  baseVersion: number;
  canKeepLocal: boolean;
  differences: AiDraftConflictField[];
  latestVersion: number;
  onApplySelection: () => void;
  onSelectedKeysChange: (keys: string[]) => void;
  onUseLatest: () => void;
  selectedKeys: string[];
}) {
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        description={
          canKeepLocal
            ? `你打开的是版本 ${baseVersion}，服务器当前为版本 ${latestVersion}。表单输入仍保留，请选择需要继续保留的本地字段。`
            : `你打开的是版本 ${baseVersion}，服务器当前为版本 ${latestVersion}，且草稿状态已经变化。本地输入仍保留供对比，但不能再写回，请切换到最新版本。`
        }
        showIcon
        title="检测到草稿版本冲突"
        type="warning"
      />
      <ProCard
        extra={
          <Space>
            <Button onClick={onUseLatest}>全部使用最新版本</Button>
            <Button
              disabled={!canKeepLocal}
              onClick={onApplySelection}
              type="primary"
            >
              应用选择并继续
            </Button>
          </Space>
        }
        size="small"
        title="字段差异"
        variant="outlined"
      >
        {differences.length ? (
          <Table<AiDraftConflictField>
            columns={columns}
            dataSource={differences}
            pagination={false}
            rowKey="key"
            rowSelection={{
              columnTitle: '保留我的输入',
              getCheckboxProps: (field) => ({
                'aria-label': `保留${field.label}的我的输入`,
                disabled: !canKeepLocal || !field.localChanged,
              }),
              onChange: (keys) => onSelectedKeysChange(keys.map(String)),
              selectedRowKeys: selectedKeys,
            }}
            scroll={{ x: 940 }}
            size="small"
          />
        ) : (
          <Typography.Text type="secondary">
            可编辑字段没有差异，但草稿版本或校验状态已经变化。请使用最新版本继续。
          </Typography.Text>
        )}
      </ProCard>
    </Space>
  );
}
