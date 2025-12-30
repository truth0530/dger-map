/**
 * 서버 측 XML 파싱 유틸리티
 * fast-xml-parser를 사용하여 XML을 JSON으로 변환
 */

import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

export interface ParsedXmlResult {
  success: boolean;
  code: string;
  message: string;
  items: Record<string, unknown>[];
  totalCount: number;
}

/**
 * XML 문자열을 파싱하여 JSON으로 변환
 */
export function parseXmlToJson(xmlString: string): ParsedXmlResult {
  try {
    const result = parser.parse(xmlString);

    const response = result.response || result;
    const header = response.header || {};
    const body = response.body || {};

    const code = String(header.resultCode || '');
    const message = String(header.resultMsg || '');
    const success = code === '00' || code === '';

    // items 추출 (배열로 정규화)
    let items: Record<string, unknown>[] = [];
    if (body.items?.item) {
      items = Array.isArray(body.items.item)
        ? body.items.item
        : [body.items.item];
    }

    const totalCount = parseInt(String(body.totalCount || '0'), 10);

    return {
      success,
      code,
      message,
      items,
      totalCount,
    };
  } catch (error) {
    console.error('[serverXmlParser] XML 파싱 오류:', error);
    return {
      success: false,
      code: 'PARSE_ERROR',
      message: error instanceof Error ? error.message : 'XML 파싱 실패',
      items: [],
      totalCount: 0,
    };
  }
}

/**
 * 파싱된 아이템에서 문자열 값 추출
 */
export function getItemText(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * 파싱된 아이템에서 숫자 값 추출
 */
export function getItemNumber(item: Record<string, unknown>, key: string): number {
  const text = getItemText(item, key);
  const num = parseInt(text, 10);
  return isNaN(num) ? 0 : num;
}
