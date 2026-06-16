import { Button, Dropdown, message } from 'antd';
import React, { useState } from 'react';
import {
  downloadPrintFile,
  fetchPrintFile,
  fetchPrintPreview,
  openHtmlPreviewWindow,
  saveBlobAsFile,
} from '@/services/myapp/printing';

export function PrintDocumentButton({
  disabled,
  docname,
  doctype,
}: {
  disabled?: boolean;
  docname: string;
  doctype: string;
}) {
  const [loading, setLoading] = useState(false);

  const runPrintAction = async (mode: 'preview' | 'download') => {
    setLoading(true);
    try {
      if (mode === 'preview') {
        const preview = await fetchPrintPreview({ docname, doctype });
        openHtmlPreviewWindow(preview);
        return;
      }

      const file = await fetchPrintFile({ docname, doctype });
      const blob = await downloadPrintFile({
        docname,
        doctype,
        filename: file.filename,
        template: file.template.key,
      });
      saveBlobAsFile(blob, file.filename);
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '打印失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dropdown
      disabled={disabled}
      menu={{
        items: [
          { key: 'preview', label: '打印预览' },
          { key: 'download', label: '下载 PDF' },
        ],
        onClick: ({ key }) => {
          void runPrintAction(key === 'download' ? 'download' : 'preview');
        },
      }}
    >
      <Button disabled={disabled} loading={loading}>
        打印
      </Button>
    </Dropdown>
  );
}
