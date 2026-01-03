const ALLOWED_ORIGINS = ['https://www.dger.kr', 'https://dger.kr'];
const DEFAULT_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const DEFAULT_HEADERS = 'Content-Type';

export function isAllowedOrigin(origin?: string | null) {
  if (!origin) return false;

  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    origin.startsWith('http://localhost')
  ) {
    return true;
  }

  return false;
}

export function getCorsHeaders(origin?: string | null) {
  let allowOrigin = ALLOWED_ORIGINS[0];

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    allowOrigin = origin;
  } else if (
    process.env.NODE_ENV !== 'production' &&
    origin &&
    origin.startsWith('http://localhost')
  ) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': DEFAULT_METHODS,
    'Access-Control-Allow-Headers': DEFAULT_HEADERS,
    'Vary': 'Origin',
  };
}
