export type ImageAspectPreset = {
  aspect: number;
  label: string;
  value: string;
};

export type ImageEditProfile = {
  accept: string;
  aspect: number;
  aspectPresets?: readonly ImageAspectPreset[];
  allowFreeAspect?: boolean;
  description: string;
  maxAspect?: number;
  maxOutputBytes: number;
  maxSourceBytes: number;
  minAspect?: number;
  minSourceEdge: number;
  outputHeight: number;
  outputMimeType: 'image/webp';
  outputQuality: number;
  outputWidth: number;
  preserveAspect?: boolean;
  profile: 'avatar-square-v1' | 'item-flexible-v2';
  title: string;
};

export type PreparedImage = {
  aspectRatio: number;
  file: File;
  height: number;
  mimeType: string;
  originalHeight: number;
  originalSize: number;
  originalWidth: number;
  profile: string;
  width: number;
};

export const ITEM_IMAGE_EDIT_PROFILE: ImageEditProfile = {
  accept: 'image/jpeg,image/png,image/webp',
  aspect: 1,
  allowFreeAspect: true,
  aspectPresets: [
    { aspect: 1, label: '1:1', value: 'square' },
    { aspect: 4 / 3, label: '4:3', value: '4:3' },
    { aspect: 3 / 2, label: '3:2', value: '3:2' },
    { aspect: 16 / 9, label: '16:9', value: '16:9' },
  ],
  description: '商品主图支持自由裁剪和常用比例，最长边输出 1600px WebP',
  maxAspect: 2.5,
  maxOutputBytes: 5 * 1024 * 1024,
  maxSourceBytes: 20 * 1024 * 1024,
  minAspect: 0.4,
  minSourceEdge: 300,
  outputHeight: 1600,
  outputMimeType: 'image/webp',
  outputQuality: 0.82,
  outputWidth: 1600,
  preserveAspect: true,
  profile: 'item-flexible-v2',
  title: '编辑商品图片',
};

export const AVATAR_IMAGE_EDIT_PROFILE: ImageEditProfile = {
  accept: 'image/jpeg,image/png,image/webp',
  aspect: 1,
  description: '正方形头像，输出 512 × 512 WebP',
  maxOutputBytes: 2 * 1024 * 1024,
  maxSourceBytes: 20 * 1024 * 1024,
  minSourceEdge: 128,
  outputHeight: 512,
  outputMimeType: 'image/webp',
  outputQuality: 0.85,
  outputWidth: 512,
  profile: 'avatar-square-v1',
  title: '编辑个人头像',
};

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageSource(file: File, profile: ImageEditProfile) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('请选择 JPG、PNG 或 WebP 图片');
  }
  if (file.size > profile.maxSourceBytes) {
    throw new Error('原始图片请控制在 20MB 以内');
  }
}

export function validateImageDimensions(
  width: number,
  height: number,
  profile: ImageEditProfile,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('无法读取图片尺寸');
  }
  if (width * height > 40_000_000) {
    throw new Error('图片像素过大，请控制在 4000 万像素以内');
  }
  if (Math.min(width, height) < profile.minSourceEdge) {
    throw new Error(
      `图片分辨率过低，最短边至少需要 ${profile.minSourceEdge} 像素`,
    );
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function clampImageAspect(aspect: number, profile: ImageEditProfile) {
  const fallback = profile.aspect > 0 ? profile.aspect : 1;
  const normalized = Number.isFinite(aspect) && aspect > 0 ? aspect : fallback;
  return Math.max(
    profile.minAspect ?? 0,
    Math.min(profile.maxAspect ?? Number.POSITIVE_INFINITY, normalized),
  );
}

export function validateCropAspect(aspect: number, profile: ImageEditProfile) {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new Error('裁剪区域比例无效，请重新调整裁剪边框');
  }
  if (
    (profile.minAspect !== undefined && aspect < profile.minAspect) ||
    (profile.maxAspect !== undefined && aspect > profile.maxAspect)
  ) {
    throw new Error(
      `裁剪比例需保持在 ${(profile.minAspect ?? 0).toFixed(2)}:1 到 ${(
        profile.maxAspect ?? Number.POSITIVE_INFINITY
      ).toFixed(2)}:1 之间`,
    );
  }
  return aspect;
}

export function getOutputDimensions(
  profile: ImageEditProfile,
  aspect = profile.aspect,
) {
  if (!profile.preserveAspect) {
    return { height: profile.outputHeight, width: profile.outputWidth };
  }

  const resolvedAspect = clampImageAspect(aspect, profile);
  if (resolvedAspect >= 1) {
    return {
      height: Math.max(1, Math.round(profile.outputWidth / resolvedAspect)),
      width: profile.outputWidth,
    };
  }
  return {
    height: profile.outputHeight,
    width: Math.max(1, Math.round(profile.outputHeight * resolvedAspect)),
  };
}

export function buildOutputFilename(filename: string, mimeType: string) {
  const extension =
    mimeType === 'image/webp'
      ? 'webp'
      : mimeType === 'image/jpeg'
        ? 'jpg'
        : 'png';
  const basename = filename.replace(/\.[^.]+$/, '').trim() || 'image';
  return `${basename}.${extension}`;
}

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? (value.split(',').pop() ?? '') : value);
    };
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片格式化失败'))),
      mimeType,
      quality,
    );
  });
}

export async function prepareCroppedCanvas({
  canvas,
  image,
  profile,
}: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  profile: ImageEditProfile;
}): Promise<PreparedImage> {
  let quality = profile.outputQuality;
  let blob = await canvasToBlob(canvas, profile.outputMimeType, quality);
  while (blob.size > profile.maxOutputBytes && quality > 0.52) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, profile.outputMimeType, quality);
  }
  if (blob.size > profile.maxOutputBytes) {
    throw new Error('格式化后的图片仍然过大，请换一张图片');
  }

  const mimeType = blob.type || profile.outputMimeType;
  const file = new File(
    [blob],
    buildOutputFilename(image.dataset.filename || 'image', mimeType),
    {
      lastModified: Date.now(),
      type: mimeType,
    },
  );
  return {
    aspectRatio: Number((canvas.width / canvas.height).toFixed(6)),
    file,
    height: canvas.height,
    mimeType,
    originalHeight: image.naturalHeight,
    originalSize: Number(image.dataset.fileSize || 0),
    originalWidth: image.naturalWidth,
    profile: profile.profile,
    width: canvas.width,
  };
}
