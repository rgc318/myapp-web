import type { IScannerControls } from '@zxing/browser';
import { BrowserCodeReader, BrowserMultiFormatReader } from '@zxing/browser';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  cameraAccessErrorMessage,
  cameraDeviceOptions,
  stopMediaStream,
} from '@/utils/camera';

const { Text } = Typography;

export function BarcodeScannerModal({
  onCancel,
  onScanned,
  open,
  title = '扫描商品条码',
}: {
  onCancel: () => void;
  onScanned: (barcode: string) => Promise<void> | void;
  open: boolean;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scannedRef = useRef(false);
  const mountedRef = useRef(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [manualBarcode, setManualBarcode] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const video = videoRef.current;
    const source = video?.srcObject;
    if (source && 'getTracks' in source) {
      stopMediaStream(source);
    }
    if (video) video.srcObject = null;
  }, []);

  const submitBarcode = useCallback(
    async (rawValue: string) => {
      const barcode = rawValue.trim();
      if (!barcode || scannedRef.current) return;
      scannedRef.current = true;
      stopScanner();
      setSubmitting(true);
      try {
        await onScanned(barcode);
        onCancel();
      } catch (caught) {
        scannedRef.current = false;
        setError(caught instanceof Error ? caught.message : '条码处理失败');
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [onCancel, onScanned, stopScanner],
  );

  const startScanner = useCallback(
    async (deviceId?: string) => {
      stopScanner();
      scannedRef.current = false;
      setStarting(true);
      setError('');
      try {
        if (!window.isSecureContext) {
          throw new DOMException('Insecure context', 'SecurityError');
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('当前浏览器不支持摄像头扫码，请使用手动输入');
        }
        const reader =
          readerRef.current ??
          new BrowserMultiFormatReader(undefined, {
            delayBetweenScanAttempts: 120,
            delayBetweenScanSuccess: 500,
          });
        readerRef.current = reader;
        const video = videoRef.current;
        if (!video) return;
        const controls = deviceId
          ? await reader.decodeFromVideoDevice(deviceId, video, (result) => {
              if (result) void submitBarcode(result.getText());
            })
          : await reader.decodeFromConstraints(
              {
                audio: false,
                video: { facingMode: { ideal: 'environment' } },
              },
              video,
              (result) => {
                if (result) void submitBarcode(result.getText());
              },
            );
        if (!mountedRef.current) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        const availableDevices =
          await BrowserCodeReader.listVideoInputDevices();
        const activeDeviceId =
          (video.srcObject && 'getVideoTracks' in video.srcObject
            ? video.srcObject.getVideoTracks()[0]?.getSettings().deviceId
            : undefined) ||
          deviceId ||
          availableDevices[0]?.deviceId;
        setDevices(availableDevices);
        setSelectedDeviceId(activeDeviceId);
      } catch (caught) {
        stopScanner();
        setError(cameraAccessErrorMessage(caught));
      } finally {
        if (mountedRef.current) setStarting(false);
      }
    },
    [stopScanner, submitBarcode],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      setManualBarcode('');
      setDevices([]);
      setSelectedDeviceId(undefined);
      void startScanner();
    } else {
      stopScanner();
    }
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  return (
    <Modal
      destroyOnHidden
      footer={null}
      mask={{ closable: !submitting }}
      onCancel={onCancel}
      open={open}
      title={title}
      width={680}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          description="将商品条码置于取景框中央，识别成功后只会提交一次。支持内置及外置摄像头。"
          showIcon
          type="info"
        />
        {devices.length > 1 ? (
          <Select
            aria-label="选择扫码摄像头"
            disabled={submitting}
            onChange={(value) => {
              setSelectedDeviceId(value);
              void startScanner(value);
            }}
            options={cameraDeviceOptions(devices)}
            style={{ width: '100%' }}
            value={selectedDeviceId}
          />
        ) : null}
        {error ? <Alert message={error} showIcon type="warning" /> : null}
        <div
          style={{
            alignItems: 'center',
            background: '#111',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'center',
            minHeight: 320,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {starting || submitting ? <Spin size="large" /> : null}
          <video
            aria-label="条码扫描预览"
            autoPlay
            muted
            playsInline
            ref={videoRef}
            style={{ display: starting ? 'none' : 'block', width: '100%' }}
          />
          {!starting && !error ? (
            <div
              aria-hidden
              style={{
                border: '2px solid #52c41a',
                borderRadius: 8,
                height: '42%',
                left: '12%',
                pointerEvents: 'none',
                position: 'absolute',
                top: '29%',
                width: '76%',
              }}
            />
          ) : null}
        </div>
        <Text type="secondary">无法授权或识别时，可在下方手动输入条码。</Text>
        <Space.Compact block>
          <Input
            aria-label="手动输入条码"
            disabled={submitting}
            onChange={(event) => setManualBarcode(event.target.value)}
            onPressEnter={() => void submitBarcode(manualBarcode)}
            placeholder="手动输入条码"
            value={manualBarcode}
          />
          <Button
            disabled={!manualBarcode.trim()}
            loading={submitting}
            onClick={() => void submitBarcode(manualBarcode)}
            type="primary"
          >
            使用条码
          </Button>
        </Space.Compact>
      </Space>
    </Modal>
  );
}
