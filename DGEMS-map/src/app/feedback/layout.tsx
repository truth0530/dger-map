import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '피드백 | DGER',
  description: 'DGER 서비스 피드백 및 릴리즈 노트. 서비스 개선 의견을 공유하고 업데이트 내역을 확인하세요.',
  keywords: ['피드백', '릴리즈노트', '업데이트', 'DGER'],
  openGraph: {
    title: '피드백 | DGER',
    description: 'DGER 서비스 피드백 및 릴리즈 노트',
    type: 'website',
  },
};

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
