import {
  EditOutlined,
  RedoOutlined,
  ReloadOutlined,
  UndoOutlined,
  ZoomInOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Modal,
  message,
  Row,
  Slider,
  Space,
  Typography,
  Upload,
} from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  clampImageOffset,
  formatBytes,
  getCoverScale,
  type ImageEditProfile,
  type ImageOffset,
  type PreparedImage,
  renderEditedImage,
  validateImageDimensions,
  validateImageSource,
} from '@/utils/image-processing';

const { Text } = Typography;

type SourceDimensions = { height: number; width: number };
type ViewportDimensions = { height: number; width: number };

export function ImageEditorUpload({
  children,
  disabled,
  onPrepared,
  profile,
  sourceUrl,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onPrepared: (image: PreparedImage) => Promise<void> | void;
  profile: ImageEditProfile;
  sourceUrl?: string | null;
}) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const uploadProps: UploadProps = {
    accept: profile.accept,
    beforeUpload: (file) => {
      try {
        validateImageSource(file, profile);
        setSourceFile(file);
      } catch (caught) {
        message.error(
          caught instanceof Error ? caught.message : '图片无法读取',
        );
      }
      return Upload.LIST_IGNORE;
    },
    disabled,
    maxCount: 1,
    showUploadList: false,
  };

  const editCurrentImage = async () => {
    if (!sourceUrl) return;
    setLoadingSource(true);
    try {
      const response = await fetch(sourceUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('当前图片读取失败');
      const blob = await response.blob();
      const sourceName = decodeURIComponent(
        new URL(sourceUrl, window.location.href).pathname.split('/').pop() ||
          'current-image',
      );
      const file = new File([blob], sourceName, {
        lastModified: Date.now(),
        type: blob.type,
      });
      validateImageSource(file, profile);
      setSourceFile(file);
    } catch (caught) {
      message.error(
        caught instanceof Error
          ? `${caught.message}，请重新选择本地原图`
          : '当前图片无法重新编辑，请选择本地原图',
      );
    } finally {
      setLoadingSource(false);
    }
  };

  return (
    <>
      <Space wrap size={8}>
        <Upload {...uploadProps}>{children}</Upload>
        {sourceUrl ? (
          <Button
            disabled={disabled}
            icon={<EditOutlined />}
            loading={loadingSource}
            onClick={editCurrentImage}
          >
            重新裁剪
          </Button>
        ) : null}
      </Space>
      <ImageEditorModal
        file={sourceFile}
        onCancel={() => setSourceFile(null)}
        onPrepared={async (image) => {
          await onPrepared(image);
          setSourceFile(null);
        }}
        profile={profile}
      />
    </>
  );
}

function ImageEditorModal({
  file,
  onCancel,
  onPrepared,
  profile,
}: {
  file: File | null;
  onCancel: () => void;
  onPrepared: (image: PreparedImage) => Promise<void> | void;
  profile: ImageEditProfile;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    offset: ImageOffset;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [source, setSource] = useState<SourceDimensions | null>(null);
  const [viewport, setViewport] = useState<ViewportDimensions>({
    height: 420,
    width: 420,
  });
  const [offset, setOffset] = useState<ImageOffset>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setObjectUrl('');
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
    setSource(null);
    setZoom(1);
    return () => URL.revokeObjectURL?.(nextUrl);
  }, [file]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ height: rect.height, width: rect.width });
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [file]);

  const baseScale = useMemo(() => {
    if (!source) return 1;
    return getCoverScale({
      imageHeight: source.height,
      imageWidth: source.width,
      rotation,
      viewportHeight: viewport.height,
      viewportWidth: viewport.width,
    });
  }, [rotation, source, viewport]);

  const clampOffset = (nextOffset: ImageOffset, nextZoom = zoom) => {
    if (!source) return nextOffset;
    return clampImageOffset({
      baseScale,
      imageHeight: source.height,
      imageWidth: source.width,
      offset: nextOffset,
      rotation,
      viewportHeight: viewport.height,
      viewportWidth: viewport.width,
      zoom: nextZoom,
    });
  };

  useEffect(() => {
    setOffset((current) => clampOffset(current));
  }, [baseScale, source, viewport.height, viewport.width]);

  const reset = () => {
    setOffset({ x: 0, y: 0 });
    setRotation(0);
    setZoom(1);
  };

  const rotate = (change: number) => {
    setRotation((current) => (current + change + 360) % 360);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image || !file) return;
    try {
      validateImageDimensions(image.naturalWidth, image.naturalHeight, profile);
      image.dataset.filename = file.name;
      image.dataset.fileSize = String(file.size);
      setSource({ height: image.naturalHeight, width: image.naturalWidth });
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '图片尺寸无效');
      onCancel();
    }
  };

  const handleConfirm = async () => {
    const image = imageRef.current;
    if (!image || !source) return;
    setSaving(true);
    try {
      const prepared = await renderEditedImage({
        image,
        offset,
        profile,
        rotation,
        viewportHeight: viewport.height,
        viewportWidth: viewport.width,
        zoom,
      });
      await onPrepared(prepared);
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '图片处理失败');
    } finally {
      setSaving(false);
    }
  };

  const imageScale = baseScale * zoom;

  return (
    <Modal
      cancelButtonProps={{ disabled: saving }}
      destroyOnHidden
      mask={{ closable: !saving }}
      okButtonProps={{ disabled: !source, loading: saving }}
      okText="应用并上传"
      onCancel={onCancel}
      onOk={handleConfirm}
      open={Boolean(file)}
      title={profile.title}
      width={760}
    >
      <Alert
        description="拖动图片调整取景范围，使用缩放和旋转修正构图。系统会移除原图元数据并生成统一规格。"
        showIcon
        style={{ marginBottom: 16 }}
        title={profile.description}
        type="info"
      />
      <Row gutter={[24, 20]}>
        <Col md={16} xs={24}>
          <div
            onPointerDown={(event) => {
              if (!source) return;
              dragRef.current = {
                offset,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              setOffset(
                clampOffset({
                  x: drag.offset.x + event.clientX - drag.startX,
                  y: drag.offset.y + event.clientY - drag.startY,
                }),
              );
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            ref={viewportRef}
            style={{
              aspectRatio: String(profile.aspect),
              background:
                'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              backgroundSize: '16px 16px',
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              cursor: source ? 'grab' : 'default',
              maxHeight: 480,
              overflow: 'hidden',
              position: 'relative',
              touchAction: 'none',
              userSelect: 'none',
              width: '100%',
            }}
          >
            {objectUrl ? (
              <div
                style={{
                  height: source?.height,
                  left: '50%',
                  pointerEvents: 'none',
                  position: 'absolute',
                  top: '50%',
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                  transformOrigin: 'center',
                  width: source?.width,
                }}
              >
                <img
                  alt="待裁剪图片"
                  draggable={false}
                  onError={() => {
                    message.error('图片内容无法解析，请选择其他图片');
                    onCancel();
                  }}
                  onLoad={handleImageLoad}
                  ref={imageRef}
                  src={objectUrl}
                  style={{
                    display: 'block',
                    height: '100%',
                    maxWidth: 'none',
                    transform: `rotate(${rotation}deg) scale(${imageScale})`,
                    transformOrigin: 'center',
                    width: '100%',
                  }}
                />
              </div>
            ) : null}
            {[1, 2].map((index) => (
              <React.Fragment key={index}>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.72)',
                    height: '100%',
                    left: `${(index * 100) / 3}%`,
                    pointerEvents: 'none',
                    position: 'absolute',
                    top: 0,
                    width: 1,
                  }}
                />
                <div
                  style={{
                    background: 'rgba(255,255,255,0.72)',
                    height: 1,
                    left: 0,
                    pointerEvents: 'none',
                    position: 'absolute',
                    top: `${(index * 100) / 3}%`,
                    width: '100%',
                  }}
                />
              </React.Fragment>
            ))}
          </div>
        </Col>
        <Col md={8} xs={24}>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Space size={6}>
                <ZoomInOutlined />
                <Text>缩放</Text>
              </Space>
              <Slider
                disabled={!source}
                max={3}
                min={1}
                onChange={(nextZoom) => {
                  setZoom(nextZoom);
                  setOffset((current) => clampOffset(current, nextZoom));
                }}
                step={0.01}
                tooltip={{
                  formatter: (value) => `${Math.round((value ?? 1) * 100)}%`,
                }}
                value={zoom}
              />
            </div>
            <Space wrap>
              <Button icon={<UndoOutlined />} onClick={() => rotate(-90)}>
                左转
              </Button>
              <Button icon={<RedoOutlined />} onClick={() => rotate(90)}>
                右转
              </Button>
              <Button icon={<ReloadOutlined />} onClick={reset}>
                重置
              </Button>
            </Space>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="原图">
                {source ? `${source.width} × ${source.height}` : '读取中'}
              </Descriptions.Item>
              <Descriptions.Item label="原始大小">
                {file ? formatBytes(file.size) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="输出">
                {profile.outputWidth} × {profile.outputHeight}
              </Descriptions.Item>
              <Descriptions.Item label="格式">WebP</Descriptions.Item>
              <Descriptions.Item label="质量">
                {Math.round(profile.outputQuality * 100)}%
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Col>
      </Row>
    </Modal>
  );
}
