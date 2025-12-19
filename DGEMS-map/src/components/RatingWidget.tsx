'use client';

/**
 * 평점 위젯 컴포넌트
 * 페이지별 별점 평가 UI
 */

import { useState, useEffect } from 'react';

interface RatingWidgetProps {
  page: string;
  label: string;
}

interface RatingData {
  ratings: Record<number, number>;
  userVote: number | null;
  total: number;
}

export default function RatingWidget({ page, label }: RatingWidgetProps) {
  const [data, setData] = useState<RatingData | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // 평점 조회
  useEffect(() => {
    const fetchRating = async () => {
      try {
        const response = await fetch(`/api/ratings?page=${encodeURIComponent(page)}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('평점 조회 오류:', error);
      }
    };

    fetchRating();
  }, [page]);

  // 평점 제출
  const submitRating = async (rating: number) => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, rating })
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('평점 제출 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 평균 평점 계산
  const calculateAverage = (): string => {
    if (!data || data.total === 0) return '0.0';

    let sum = 0;
    for (let i = 1; i <= 5; i++) {
      sum += i * (data.ratings[i] || 0);
    }
    return (sum / data.total).toFixed(1);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700 font-medium">{label}</span>

      <div className="flex items-center gap-3">
        {/* 별점 */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = hoveredStar !== null
              ? star <= hoveredStar
              : data?.userVote
                ? star <= data.userVote
                : false;

            return (
              <button
                key={star}
                onClick={() => submitRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(null)}
                disabled={loading}
                className={`w-6 h-6 transition-colors ${loading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                title={`${star}점`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill={isFilled ? '#fbbf24' : 'none'}
                  stroke={isFilled ? '#fbbf24' : '#d1d5db'}
                  strokeWidth="1.5"
                  className="w-full h-full"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </button>
            );
          })}
        </div>

        {/* 통계 */}
        <div className="text-xs text-gray-500 min-w-[60px] text-right">
          {data ? (
            <>
              <span className="font-medium text-yellow-600">{calculateAverage()}</span>
              <span className="text-gray-400 ml-1">({data.total})</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </div>
    </div>
  );
}
