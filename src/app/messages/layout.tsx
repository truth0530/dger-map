import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '응급 메시지 | DGER',
  description: '병원별 응급실 및 중증질환 메시지 실시간 조회. 의료진 부족, 병상 만실 등 응급실 상황 메시지 확인.',
  keywords: ['응급메시지', '응급실', '병원메시지', '의료진부족', '병상만실'],
  openGraph: {
    title: '응급 메시지 | DGER',
    description: '병원별 응급실 및 중증질환 메시지',
    type: 'website',
  },
};

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
