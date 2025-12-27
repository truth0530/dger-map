'use client';

import { cn } from '@/lib/utils';

export type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_STYLES: Record<StatusType, { bg: string; text: string; border: string }> = {
  success: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30'
  },
  warning: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30'
  },
  danger: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30'
  },
  info: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30'
  },
  neutral: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/30'
  }
};

const SIZE_STYLES = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5'
};

/**
 * 상태 배지 컴포넌트
 * 다양한 상태(성공, 경고, 위험 등)를 시각적으로 표시
 */
export function StatusBadge({
  status,
  children,
  size = 'md',
  className
}: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        styles.bg,
        styles.text,
        styles.border,
        SIZE_STYLES[size],
        className
      )}
      role="status"
    >
      {children}
    </span>
  );
}

/**
 * 병상 상태 배지
 */
export function BedStatusBadge({
  available,
  total,
  className
}: {
  available: number;
  total: number;
  className?: string;
}) {
  const getStatus = (): StatusType => {
    if (total === 0) return 'neutral';
    const rate = (available / total) * 100;
    if (rate <= 5) return 'danger';
    if (rate <= 40) return 'warning';
    return 'success';
  };

  const status = getStatus();
  const rate = total > 0 ? Math.round((available / total) * 100) : 0;

  return (
    <StatusBadge status={status} size="sm" className={className}>
      {available}/{total} ({rate}%)
    </StatusBadge>
  );
}

/**
 * 중증질환 수용 상태 배지
 */
export function SevereStatusBadge({
  isAvailable,
  className
}: {
  isAvailable: boolean | null;
  className?: string;
}) {
  if (isAvailable === null) {
    return (
      <StatusBadge status="neutral" size="sm" className={className}>
        정보없음
      </StatusBadge>
    );
  }

  return (
    <StatusBadge
      status={isAvailable ? 'success' : 'danger'}
      size="sm"
      className={className}
    >
      {isAvailable ? '가능' : '불가'}
    </StatusBadge>
  );
}

/**
 * 병원 등급 배지
 */
export function HospitalLevelBadge({
  level,
  className
}: {
  level: '권역응급의료센터' | '지역응급의료센터' | '전문응급의료센터' | '지역응급의료기관' | '기타';
  className?: string;
}) {
  const getStatus = (): StatusType => {
    switch (level) {
      case '권역응급의료센터':
        return 'danger';
      case '지역응급의료센터':
        return 'warning';
      case '전문응급의료센터':
        return 'info';
      case '지역응급의료기관':
        return 'success';
      default:
        return 'neutral';
    }
  };

  const getShortLabel = (): string => {
    switch (level) {
      case '권역응급의료센터':
        return '권역';
      case '지역응급의료센터':
        return '지역센터';
      case '전문응급의료센터':
        return '전문';
      case '지역응급의료기관':
        return '기관';
      default:
        return '기타';
    }
  };

  return (
    <StatusBadge status={getStatus()} size="sm" className={className}>
      {getShortLabel()}
    </StatusBadge>
  );
}
