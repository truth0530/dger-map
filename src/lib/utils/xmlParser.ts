/**
 * XML 파싱 유틸리티
 */

// 브라우저 환경에서 XML 파싱
export function parseXml(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

// XML 아이템에서 텍스트 값 추출
export function getXmlText(item: Element, tagName: string): string {
  return item.querySelector(tagName)?.textContent?.trim() || '';
}

// XML 아이템에서 숫자 값 추출
export function getXmlNumber(item: Element, tagName: string): number {
  const text = getXmlText(item, tagName);
  return parseInt(text || '0', 10);
}

// API 결과 코드 확인
export function checkResultCode(doc: Document): { success: boolean; code: string; message: string } {
  const code = doc.querySelector('resultCode')?.textContent?.trim() || '';
  const message = doc.querySelector('resultMsg')?.textContent?.trim() || '';

  return {
    success: code === '00' || code === '',
    code,
    message
  };
}

// XML 문서에서 아이템 목록 추출
export function getXmlItems(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('item'));
}
