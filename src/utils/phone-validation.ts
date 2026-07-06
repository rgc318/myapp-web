export const PHONE_MAX_LENGTH = 20;
export const PHONE_MIN_LENGTH = 6;

export function normalizePhoneInput(value: unknown) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, PHONE_MAX_LENGTH);
}

export function isValidPhone(value: unknown) {
  const phone = normalizePhoneInput(value);
  if (!phone) {
    return true;
  }
  return phone.length >= PHONE_MIN_LENGTH && phone.length <= PHONE_MAX_LENGTH;
}

export function phoneValidationMessage() {
  return `联系电话只能输入 ${PHONE_MIN_LENGTH}-${PHONE_MAX_LENGTH} 位数字`;
}

export async function validatePhoneValue(_: unknown, value: unknown) {
  if (isValidPhone(value)) {
    return;
  }
  throw new Error(phoneValidationMessage());
}
