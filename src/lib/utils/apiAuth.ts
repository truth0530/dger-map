export function isApiKeyRequired() {
  return Boolean(process.env.DGER_INTERNAL_API_KEY);
}

export function isAuthorizedRequest(headerValue?: string | null) {
  const requiredKey = process.env.DGER_INTERNAL_API_KEY;
  if (!requiredKey) return true;
  if (!headerValue) return false;
  return headerValue === requiredKey;
}
