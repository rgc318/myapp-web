import { ScanOutlined } from '@ant-design/icons';
import type { ButtonProps } from 'antd';
import { Button } from 'antd';
import React, { useState } from 'react';
import { BarcodeScannerModal } from './BarcodeScannerModal';

export function BarcodeScannerButton({
  buttonProps,
  label = '扫码',
  onScanned,
  title,
}: {
  buttonProps?: ButtonProps;
  label?: React.ReactNode;
  onScanned: (barcode: string) => Promise<void> | void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        {...buttonProps}
        icon={buttonProps?.icon ?? <ScanOutlined />}
        onClick={(event) => {
          buttonProps?.onClick?.(event);
          if (!event.defaultPrevented) setOpen(true);
        }}
      >
        {label}
      </Button>
      <BarcodeScannerModal
        onCancel={() => setOpen(false)}
        onScanned={onScanned}
        open={open}
        title={title}
      />
    </>
  );
}
