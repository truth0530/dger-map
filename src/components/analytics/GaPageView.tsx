'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getGaPagePath } from '@/lib/utils/gaPageMapping';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_CHECK_INTERVAL = 100; // ms
const GA_CHECK_MAX_ATTEMPTS = 50; // 최대 5초 대기

export default function GaPageView() {
  const pathname = usePathname();
  const sentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    // 동일 pathname에 대해 중복 전송 방지
    if (sentRef.current === pathname) return;

    const sendPageView = () => {
      if (!window.gtag) return false;

      const gaPath = getGaPagePath(pathname);
      window.gtag('event', 'page_view', {
        page_path: gaPath,
        // GA가 계산하는 페이지 경로는 page_location 기준이므로 매핑된 경로로 전송
        page_location: `${window.location.origin}${gaPath}`,
        page_title: document.title,
      });
      sentRef.current = pathname;
      return true;
    };

    // gtag가 이미 로드되어 있으면 바로 전송
    if (sendPageView()) return;

    // gtag 로드 대기 (최초 페이지 로드 시)
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (sendPageView() || attempts >= GA_CHECK_MAX_ATTEMPTS) {
        clearInterval(checkInterval);
      }
    }, GA_CHECK_INTERVAL);

    return () => clearInterval(checkInterval);
  }, [pathname]);

  return null;
}
