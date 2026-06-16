import { SettingOutlined } from '@ant-design/icons';
import { Button, Form, Modal, message, Space, Tooltip } from 'antd';
import React, { useState } from 'react';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import {
  getCurrentUserWorkspacePreferences,
  updateCurrentUserWorkspacePreferences,
} from '@/services/myapp/workspace';

type WorkspacePreferenceFormValues = {
  defaultCompany?: string;
  defaultWarehouse?: string;
};

export function WorkspacePreferenceButton() {
  const [form] = Form.useForm<WorkspacePreferenceFormValues>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const defaultCompany = Form.useWatch('defaultCompany', form);

  const openModal = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const preferences = await getCurrentUserWorkspacePreferences();
      form.setFieldsValue({
        defaultCompany: preferences.defaultCompany || undefined,
        defaultWarehouse: preferences.defaultWarehouse || undefined,
      });
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '偏好加载失败');
    } finally {
      setLoading(false);
    }
  };

  const submit = async (values: WorkspacePreferenceFormValues) => {
    setSaving(true);
    try {
      await updateCurrentUserWorkspacePreferences({
        defaultCompany: values.defaultCompany,
        defaultWarehouse: values.defaultWarehouse,
      });
      setOpen(false);
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '偏好保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tooltip title="工作偏好">
        <Button
          icon={<SettingOutlined />}
          loading={loading}
          onClick={() => void openModal()}
          type="text"
        />
      </Tooltip>
      <Modal
        confirmLoading={saving}
        destroyOnHidden
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        open={open}
        title="工作偏好"
      >
        <Form<WorkspacePreferenceFormValues>
          form={form}
          layout="vertical"
          onFinish={submit}
        >
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Form.Item label="默认公司" name="defaultCompany">
              <RemoteLinkSelect doctype="Company" placeholder="搜索公司" />
            </Form.Item>
            <Form.Item label="默认仓库" name="defaultWarehouse">
              <RemoteLinkSelect
                doctype="Warehouse"
                extraFields={['company']}
                filters={{ company: defaultCompany }}
                placeholder="搜索仓库"
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
