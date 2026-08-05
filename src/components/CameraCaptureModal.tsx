import { CameraOutlined, RedoOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Select, Space, Spin, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  cameraAccessErrorMessage,
  cameraDeviceOptions,
  stopMediaStream,
} from '@/utils/camera';

const { Text } = Typography;

function captureFilename() {
  return `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
}

export function CameraCaptureModal({
  onCancel,
  onCaptured,
  open,
}: {
  onCancel: () => void;
  onCaptured: (file: File) => Promise<void> | void;
  open: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedUrl, setCapturedUrl] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const stopCamera = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const clearCapture = useCallback(() => {
    setCapturedFile(null);
    setCapturedUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopCamera();
      setStarting(true);
      setError('');
      try {
        if (!window.isSecureContext) {
          throw new DOMException('Insecure context', 'SecurityError');
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('当前浏览器不支持摄像头访问，请改用文件上传');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: { ideal: 'environment' },
                height: { ideal: 1080 },
                width: { ideal: 1920 },
              },
        });
        if (!mountedRef.current) {
          stopMediaStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        const videoDevices = await navigator.mediaDevices.enumerateDevices();
        const availableDevices = videoDevices.filter(
          (device) => device.kind === 'videoinput',
        );
        const activeDeviceId =
          stream.getVideoTracks()[0]?.getSettings().deviceId ||
          deviceId ||
          availableDevices[0]?.deviceId;
        setDevices(availableDevices);
        setSelectedDeviceId(activeDeviceId);
      } catch (caught) {
        stopCamera();
        setError(cameraAccessErrorMessage(caught));
      } finally {
        if (mountedRef.current) setStarting(false);
      }
    },
    [stopCamera],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      clearCapture();
      setDevices([]);
      setSelectedDeviceId(undefined);
      void startCamera();
    } else {
      stopCamera();
      clearCapture();
    }
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [clearCapture, open, startCamera, stopCamera]);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setError('摄像头画面尚未准备好，请稍后重试');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('当前浏览器无法生成拍摄图片');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.95),
    );
    if (!blob) {
      setError('拍摄图片生成失败，请重试');
      return;
    }
    clearCapture();
    const file = new File([blob], captureFilename(), {
      lastModified: Date.now(),
      type: 'image/jpeg',
    });
    setCapturedFile(file);
    setCapturedUrl(URL.createObjectURL(file));
    stopCamera();
  };

  const confirmCapture = async () => {
    if (!capturedFile) return;
    setConfirming(true);
    try {
      await onCaptured(capturedFile);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      cancelButtonProps={{ disabled: confirming }}
      destroyOnHidden
      footer={
        capturedFile ? (
          <Space>
            <Button
              disabled={confirming}
              icon={<RedoOutlined />}
              onClick={() => {
                clearCapture();
                void startCamera(selectedDeviceId);
              }}
            >
              重拍
            </Button>
            <Button
              loading={confirming}
              onClick={confirmCapture}
              type="primary"
            >
              使用照片并裁剪
            </Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button
              disabled={starting || Boolean(error)}
              icon={<CameraOutlined />}
              onClick={() => void takePhoto()}
              type="primary"
            >
              拍照
            </Button>
          </Space>
        )
      }
      mask={{ closable: !confirming }}
      onCancel={onCancel}
      open={open}
      title="拍照上传"
      width={760}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          description="支持平板、电脑内置摄像头和外置 USB 摄像头。拍摄确认后仍会进入统一裁剪和压缩流程。"
          showIcon
          type="info"
        />
        {devices.length > 1 && !capturedFile ? (
          <Select
            aria-label="选择摄像头"
            onChange={(value) => {
              setSelectedDeviceId(value);
              void startCamera(value);
            }}
            options={cameraDeviceOptions(devices)}
            style={{ width: '100%' }}
            value={selectedDeviceId}
          />
        ) : null}
        {error ? (
          <Alert
            action={
              <Button onClick={() => void startCamera(selectedDeviceId)}>
                重试
              </Button>
            }
            message={error}
            showIcon
            type="error"
          />
        ) : null}
        <div
          style={{
            alignItems: 'center',
            background: '#111',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'center',
            minHeight: 360,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {starting ? <Spin size="large" /> : null}
          {capturedUrl ? (
            <img
              alt="拍摄预览"
              src={capturedUrl}
              style={{ display: 'block', maxHeight: 520, maxWidth: '100%' }}
            />
          ) : (
            <video
              aria-label="摄像头预览"
              autoPlay
              muted
              playsInline
              ref={videoRef}
              style={{ display: starting ? 'none' : 'block', width: '100%' }}
            />
          )}
        </div>
        <Text type="secondary">
          浏览器会按设备请求摄像头权限；生产环境需使用 HTTPS，localhost
          可用于本地调试。
        </Text>
      </Space>
    </Modal>
  );
}
