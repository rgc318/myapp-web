import {
  EditOutlined,
  RedoOutlined,
  ReloadOutlined,
  SwapOutlined,
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
  Segmented,
  Slider,
  Space,
  Typography,
  Upload,
} from 'antd';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import React, { useEffect, useRef, useState } from 'react';
import {
  formatBytes,
  getOutputDimensions,
  type ImageEditProfile,
  type PreparedImage,
  prepareCroppedCanvas,
  validateCropAspect,
  validateImageDimensions,
  validateImageSource,
} from '@/utils/image-processing';

const { Text } = Typography;
const FREE_ASPECT_VALUE = 'free';

type SourceDimensions = { height: number; width: number };

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const initialImageRatioRef = useRef(0);
  const [objectUrl, setObjectUrl] = useState('');
  const [source, setSource] = useState<SourceDimensions | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [aspectMode, setAspectMode] = useState(
    profile.aspectPresets?.[0]?.value ?? 'fixed',
  );
  const [cropAspect, setCropAspect] = useState(profile.aspect);
  const [cropAspectError, setCropAspectError] = useState<string | null>(null);

  const syncCropAspect = (nextAspect: number) => {
    setCropAspect(nextAspect);
    try {
      validateCropAspect(nextAspect, profile);
      setCropAspectError(null);
    } catch (caught) {
      setCropAspectError(
        caught instanceof Error ? caught.message : '裁剪比例无效',
      );
    }
  };

  useEffect(() => {
    cropperRef.current?.destroy();
    cropperRef.current = null;
    initialImageRatioRef.current = 0;
    if (!file) {
      setObjectUrl('');
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    setSource(null);
    setZoom(1);
    setAspectMode(profile.aspectPresets?.[0]?.value ?? 'fixed');
    setCropAspect(profile.aspect);
    setCropAspectError(null);
    return () => {
      cropperRef.current?.destroy();
      cropperRef.current = null;
      URL.revokeObjectURL?.(nextUrl);
    };
  }, [file, profile]);

  const reset = () => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    cropper.reset();
    if (aspectMode === FREE_ASPECT_VALUE) {
      cropper.setAspectRatio(Number.NaN);
    } else {
      const preset = profile.aspectPresets?.find(
        (option) => option.value === aspectMode,
      );
      cropper.setAspectRatio(preset?.aspect ?? profile.aspect);
    }
    const imageData = cropper.getImageData();
    initialImageRatioRef.current =
      imageData.naturalWidth > 0 ? imageData.width / imageData.naturalWidth : 0;
    setZoom(1);
    const cropData = cropper.getData();
    syncCropAspect(cropData.width / cropData.height);
  };

  const selectAspectMode = (nextMode: string) => {
    setAspectMode(nextMode);
    const cropper = cropperRef.current;
    if (nextMode === FREE_ASPECT_VALUE) {
      cropper?.setAspectRatio(Number.NaN);
      if (cropper) {
        const cropData = cropper.getData();
        syncCropAspect(cropData.width / cropData.height);
      }
    } else {
      const preset = profile.aspectPresets?.find(
        (option) => option.value === nextMode,
      );
      const nextAspect = preset?.aspect ?? profile.aspect;
      cropper?.setAspectRatio(nextAspect);
      syncCropAspect(nextAspect);
    }
  };

  const rotate = (change: number) => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    cropper.rotate(change);
    const imageData = cropper.getImageData();
    initialImageRatioRef.current =
      imageData.naturalWidth > 0 ? imageData.width / imageData.naturalWidth : 0;
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
      cropperRef.current?.destroy();
      const initialAspect =
        profile.aspectPresets?.[0]?.aspect ?? profile.aspect;
      const cropper = new Cropper(image, {
        aspectRatio: initialAspect,
        autoCropArea: 0.82,
        background: false,
        center: true,
        crop: (event) => {
          if (event.detail.height > 0) {
            syncCropAspect(event.detail.width / event.detail.height);
          }
        },
        cropBoxMovable: true,
        cropBoxResizable: true,
        dragMode: 'move',
        guides: true,
        highlight: true,
        minContainerHeight: 320,
        minContainerWidth: 280,
        minCropBoxHeight: 80,
        minCropBoxWidth: 80,
        modal: true,
        movable: true,
        ready: () => {
          const imageData = cropper.getImageData();
          initialImageRatioRef.current =
            imageData.naturalWidth > 0
              ? imageData.width / imageData.naturalWidth
              : 0;
          setZoom(1);
          const cropData = cropper.getData();
          syncCropAspect(cropData.width / cropData.height);
        },
        responsive: true,
        restore: false,
        rotatable: true,
        toggleDragModeOnDblclick: false,
        viewMode: 1,
        wheelZoomRatio: 0.08,
        zoom: (event) => {
          const initialRatio = initialImageRatioRef.current;
          if (initialRatio <= 0) return;
          const nextZoom = event.detail.ratio / initialRatio;
          if (nextZoom < 1 || nextZoom > 3) {
            event.preventDefault();
            return;
          }
          setZoom(nextZoom);
        },
        zoomOnTouch: true,
        zoomOnWheel: true,
        zoomable: true,
      });
      cropperRef.current = cropper;
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '图片尺寸无效');
      onCancel();
    }
  };

  const handleConfirm = async () => {
    const image = imageRef.current;
    const cropper = cropperRef.current;
    if (!image || !source || !cropper) return;
    setSaving(true);
    try {
      const cropData = cropper.getData();
      const finalAspect = validateCropAspect(
        cropData.width / cropData.height,
        profile,
      );
      const dimensions = getOutputDimensions(profile, finalAspect);
      const canvas = cropper.getCroppedCanvas({
        height: dimensions.height,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        width: dimensions.width,
      });
      if (!canvas) throw new Error('当前裁剪区域无法生成图片');
      const prepared = await prepareCroppedCanvas({
        canvas,
        image,
        profile,
      });
      await onPrepared(prepared);
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '图片处理失败');
    } finally {
      setSaving(false);
    }
  };

  const outputDimensions = getOutputDimensions(profile, cropAspect);
  const aspectOptions = [
    ...(profile.aspectPresets ?? []).map((option) => ({
      label: option.label,
      value: option.value,
    })),
    ...(profile.allowFreeAspect
      ? [{ label: '自由', value: FREE_ASPECT_VALUE }]
      : []),
  ];

  return (
    <Modal
      cancelButtonProps={{ disabled: saving }}
      destroyOnHidden
      mask={{ closable: !saving }}
      okButtonProps={{
        disabled: !source || Boolean(cropAspectError),
        loading: saving,
      }}
      okText="应用并上传"
      onCancel={onCancel}
      onOk={handleConfirm}
      open={Boolean(file)}
      title={profile.title}
      width={840}
    >
      <Alert
        description="拖动裁剪框内部可移动边框，拖动框外图片可移动画面；四边和四角均可调整范围。预设比例会锁定边框比例，自由模式可任意缩放。"
        showIcon
        style={{ marginBottom: 16 }}
        title={profile.description}
        type="info"
      />
      <Row gutter={[24, 20]}>
        <Col md={16} xs={24}>
          <div
            className="image-editor-cropper"
            style={{
              background:
                'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              backgroundSize: '16px 16px',
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              height: 'clamp(320px, 58vw, 460px)',
              margin: '0 auto',
              overflow: 'hidden',
              position: 'relative',
              width: '100%',
            }}
          >
            {objectUrl ? (
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
                  maxWidth: '100%',
                  objectFit: 'contain',
                  width: '100%',
                }}
              />
            ) : null}
          </div>
          <Text
            style={{ display: 'block', marginTop: 8, textAlign: 'center' }}
            type="secondary"
          >
            蓝色边框及八个控制点均可拖动，框外区域可拖动图片
          </Text>
        </Col>
        <Col md={8} xs={24}>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {aspectOptions.length > 0 ? (
              <div>
                <Text>裁剪比例</Text>
                <Segmented
                  block
                  disabled={!source}
                  onChange={(value) => selectAspectMode(String(value))}
                  options={aspectOptions}
                  size="small"
                  style={{ marginTop: 8 }}
                  value={aspectMode}
                />
                {aspectMode === FREE_ASPECT_VALUE ? (
                  <Space
                    orientation="vertical"
                    size={2}
                    style={{ marginTop: 8 }}
                  >
                    <Text type={cropAspectError ? 'danger' : 'secondary'}>
                      当前宽高比 {cropAspect.toFixed(2)}:1
                    </Text>
                    <Text type={cropAspectError ? 'danger' : 'secondary'}>
                      {cropAspectError ?? '拖动四边或四角自由调整裁剪范围'}
                    </Text>
                  </Space>
                ) : cropAspect !== 1 ? (
                  <Button
                    block
                    disabled={!source}
                    icon={<SwapOutlined />}
                    onClick={() => {
                      const nextAspect = 1 / cropAspect;
                      cropperRef.current?.setAspectRatio(nextAspect);
                      syncCropAspect(nextAspect);
                    }}
                    size="small"
                    style={{ marginTop: 8 }}
                  >
                    切换横向 / 纵向
                  </Button>
                ) : null}
              </div>
            ) : null}
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
                  const initialRatio = initialImageRatioRef.current;
                  if (initialRatio > 0) {
                    cropperRef.current?.zoomTo(initialRatio * nextZoom);
                  }
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
                {outputDimensions.width} × {outputDimensions.height}
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
