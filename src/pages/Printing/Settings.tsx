import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Modal,
  message,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import React, { useMemo, useState } from 'react';
import {
  getPrintSettings,
  listPrintDoctypes,
  type PrintDoctypeOption,
  type PrintSetting,
  setPrintDefaultTemplate,
} from '@/services/myapp/printing';

type PrintSettingRow = PrintDoctypeOption & {
  configuredDefaultTemplate: string | null;
  configuredEnabled: boolean;
  modified: string | null;
  modifiedBy: string | null;
};

const PrintSettingsPage: React.FC = () => {
  const [editingRow, setEditingRow] = useState<PrintSettingRow | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingEnabled, setEditingEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messageApi, messageContext] = message.useMessage();

  const { data, error, loading, refresh } = useRequest(
    async () => {
      const [doctypes, settingResult] = await Promise.all([
        listPrintDoctypes(),
        getPrintSettings(),
      ]);
      const settingsByDoctype = new Map<string, PrintSetting>(
        settingResult.settings.map((item) => [item.doctype, item]),
      );
      const rows: PrintSettingRow[] = doctypes.map((item) => {
        const setting = settingsByDoctype.get(item.doctype);
        return {
          ...item,
          configuredDefaultTemplate:
            setting?.defaultTemplate ?? item.defaultTemplate,
          configuredEnabled: setting?.enabled ?? true,
          modified: setting?.modified ?? null,
          modifiedBy: setting?.modifiedBy ?? null,
        };
      });
      return { rows, tableReady: settingResult.tableReady };
    },
    { formatResult: (result) => result },
  );

  const columns = useMemo<ProColumns<PrintSettingRow>[]>(
    () => [
      {
        title: '单据类型',
        dataIndex: 'label',
        width: 180,
        render: (_, row) => (
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>{row.label}</Typography.Text>
            <Typography.Text type="secondary">{row.doctype}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '可用模板',
        dataIndex: 'templates',
        search: false,
        render: (_, row) => (
          <Space wrap>
            {row.templates.map((template) => (
              <Tag key={template.key}>{template.label}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '全局默认模板',
        dataIndex: 'configuredDefaultTemplate',
        width: 180,
        search: false,
        render: (_, row) =>
          row.templates.find(
            (item) => item.key === row.configuredDefaultTemplate,
          )?.label ??
          row.configuredDefaultTemplate ??
          '后端默认',
      },
      {
        title: '设置状态',
        dataIndex: 'configuredEnabled',
        width: 100,
        search: false,
        render: (_, row) => (
          <Tag color={row.configuredEnabled ? 'success' : 'default'}>
            {row.configuredEnabled ? '启用' : '停用'}
          </Tag>
        ),
      },
      {
        title: '最近修改',
        dataIndex: 'modified',
        width: 210,
        search: false,
        render: (_, row) =>
          [row.modifiedBy, row.modified].filter(Boolean).join(' · ') || '-',
      },
      {
        title: '操作',
        valueType: 'option',
        width: 100,
        render: (_, row) => [
          <Button
            key="edit"
            onClick={() => {
              setEditingRow(row);
              setEditingTemplate(row.configuredDefaultTemplate);
              setEditingEnabled(row.configuredEnabled);
            }}
            type="link"
          >
            设置
          </Button>,
        ],
      },
    ],
    [],
  );

  const saveSetting = async () => {
    if (!editingRow || !editingTemplate) {
      messageApi.error('请选择默认模板');
      return;
    }
    setSaving(true);
    try {
      await setPrintDefaultTemplate({
        doctype: editingRow.doctype,
        enabled: editingEnabled,
        metadata: { client: 'web', source_page: 'printing_settings' },
        template: editingTemplate,
      });
      messageApi.success('默认打印模板已保存');
      setEditingRow(null);
      refresh();
    } catch (caught) {
      messageApi.error(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer
      title="打印设置"
      extra={[
        <Button key="refresh" onClick={refresh}>
          刷新
        </Button>,
      ]}
    >
      {messageContext}
      {data && !data.tableReady ? (
        <Alert
          showIcon
          style={{ marginBottom: 16 }}
          type="warning"
          title="打印设置表尚未创建"
          description="请先在目标站点执行 bench migrate，再维护全局默认模板。"
        />
      ) : null}
      {error ? (
        <Alert
          action={<Button onClick={refresh}>重试</Button>}
          showIcon
          style={{ marginBottom: 16 }}
          type="error"
          title={error.message}
        />
      ) : null}
      <ProTable<PrintSettingRow>
        columns={columns}
        dataSource={data?.rows ?? []}
        loading={loading}
        pagination={false}
        rowKey="doctype"
        search={false}
        toolBarRender={false}
      />
      <Modal
        confirmLoading={saving}
        onCancel={() => setEditingRow(null)}
        onOk={() => void saveSetting()}
        open={Boolean(editingRow)}
        title={editingRow ? `设置 ${editingRow.label} 默认模板` : '打印设置'}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Select
            onChange={(value) => setEditingTemplate(value)}
            options={(editingRow?.templates ?? []).map((item) => ({
              label: `${item.label} · ${item.paperSize} · ${item.orientation}`,
              value: item.key,
            }))}
            style={{ width: '100%' }}
            value={editingTemplate ?? undefined}
          />
          <Space>
            <Switch checked={editingEnabled} onChange={setEditingEnabled} />
            <span>启用该全局默认模板设置</span>
          </Space>
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default PrintSettingsPage;
