const PAGE_PATH_MAPPING: Record<string, string> = {
  '/': '/index.html',
  '/severe': '/27severe.html',
  '/messages': '/systommsg.html',
  '/feedback': '/feed.html',
};

/**
 * Next.js pathname을 GA 페이지 경로로 변환
 * - trailing slash 정규화 처리 (/severe/ → /severe)
 * - dger-api 구 경로로 매핑 (/severe → /27severe.html)
 */
export function getGaPagePath(pathname: string): string {
  // trailing slash 제거 (루트 경로 제외)
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return PAGE_PATH_MAPPING[normalized] || pathname;
}
