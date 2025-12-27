import { redirect } from 'next/navigation';

/**
 * /bed 경로로 접근 시 메인 페이지로 리다이렉트
 * 병상현황이 메인 페이지(/)로 이동되었음
 */
export default function BedPage() {
  redirect('/');
}
