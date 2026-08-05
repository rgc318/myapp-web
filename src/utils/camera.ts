export function cameraAccessErrorMessage(caught: unknown) {
  if (!window.isSecureContext) {
    return '摄像头仅可在 HTTPS 或 localhost 环境使用';
  }
  if (!(caught instanceof DOMException)) {
    return caught instanceof Error ? caught.message : '摄像头启动失败';
  }
  if (caught.name === 'NotAllowedError' || caught.name === 'SecurityError') {
    return '摄像头权限被拒绝，请在浏览器设置中允许访问后重试';
  }
  if (
    caught.name === 'NotFoundError' ||
    caught.name === 'DevicesNotFoundError'
  ) {
    return '未检测到可用摄像头，请连接设备后重试';
  }
  if (caught.name === 'NotReadableError' || caught.name === 'TrackStartError') {
    return '摄像头正被其他应用占用，请关闭占用程序后重试';
  }
  if (caught.name === 'OverconstrainedError') {
    return '所选摄像头不支持当前配置，请切换其他摄像头';
  }
  return caught.message || '摄像头启动失败';
}

export function stopMediaStream(stream?: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export function cameraDeviceOptions(devices: MediaDeviceInfo[]) {
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      label: device.label || `摄像头 ${index + 1}`,
      value: device.deviceId,
    }));
}
