import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '중증질환 현황 | DGER',
  description: '27개 중증응급질환 수용 가능 현황 조회. 심근경색, 뇌경색, 중증외상 등 중증질환별 진료 가능 병원 확인.',
  keywords: ['중증응급질환', '심근경색', '뇌경색', '중증외상', '응급의료', '진료가능'],
  openGraph: {
    title: '중증질환 현황 | DGER',
    description: '27개 중증응급질환 수용 가능 현황',
    type: 'website',
  },
};

export default function SevereLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
