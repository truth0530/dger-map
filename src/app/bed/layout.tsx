import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '병상 현황 | DGER',
  description: '전국 응급실 병상 현황 실시간 조회. 일반병상, 코호트격리, 음압격리, 소아응급실 등 병상 유형별 현황 확인.',
  keywords: ['응급실', '병상현황', '응급의료', '음압격리', '코호트격리', '소아응급실'],
  openGraph: {
    title: '병상 현황 | DGER',
    description: '전국 응급실 병상 현황 실시간 조회',
    type: 'website',
  },
};

export default function BedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
