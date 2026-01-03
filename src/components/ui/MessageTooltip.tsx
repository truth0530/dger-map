'use client';

import { ReactNode } from 'react';
import { parseMessageWithTooltipHighlights, getHighlightClassWithTheme, HighlightedSegment, decodeHtmlEntities } from '@/lib/utils/messageClassifier';

interface MessageTooltipProps {
  message: string;
  isDark: boolean;
  children: ReactNode;
}

function renderTooltipSegments(segments: HighlightedSegment[], isDark: boolean) {
  return segments.map((segment, idx) => (
    <span
      key={idx}
      className={segment.type !== 'none' ? getHighlightClassWithTheme(segment.type, isDark) : ''}
    >
      {segment.text}
    </span>
  ));
}

export default function MessageTooltip({ message, isDark, children }: MessageTooltipProps) {
  const decodedMessage = decodeHtmlEntities(message);
  const segments = parseMessageWithTooltipHighlights(decodedMessage);
  return (
    <span className="relative inline-flex max-w-full align-middle group dger-tooltip">
      {children}
      <span
        className={`pointer-events-none absolute left-0 top-full z-50 mt-1 w-max max-w-[280px] whitespace-pre-wrap rounded border px-2 py-1 text-xs shadow transition-opacity duration-75 opacity-0 group-hover:opacity-100 ${isDark ? 'bg-gray-900 text-gray-200 border-gray-700' : 'bg-white text-gray-800 border-gray-200'}`}
      >
        {segments.length ? renderTooltipSegments(segments, isDark) : decodedMessage}
      </span>
    </span>
  );
}
