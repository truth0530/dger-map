let warnedMissingKey = false;

export function isApiKeyRequired() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.DGER_INTERNAL_API_KEY);
}

export function isAuthorizedRequest(headerValue?: string | null) {
  const requiredKey = process.env.DGER_INTERNAL_API_KEY;
  if (!requiredKey) {
    if (process.env.NODE_ENV === 'production') {
      if (!warnedMissingKey) {
        console.warn('[api-auth] DGER_INTERNAL_API_KEY가 설정되지 않았습니다.');
        warnedMissingKey = true;
      }
      return false;
    }
    return true;
  }
  if (!headerValue) return false;
  return headerValue === requiredKey;
}
