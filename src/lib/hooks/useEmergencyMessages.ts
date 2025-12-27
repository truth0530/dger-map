/**
 * 응급 메시지 데이터 훅
 * 병원별 응급실 및 중증질환 메시지 조회
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ClassifiedMessages, parseMessage } from '@/lib/utils/messageClassifier';
import { SEVERE_TYPES } from '@/lib/constants/dger';

export interface EmergencyMessage {
  msg: string;
  symTypCod: string;
  symTypCodMag: string; // 질환명 (예: "뇌출혈수술(거미막하 출혈 외)")
  symBlkMsgTyp: string; // 메시지 타입 (예: "중증", "응급")
  rnum?: string;
}

interface UseEmergencyMessagesReturn {
  messages: Map<string, ClassifiedMessages>;
  loading: Map<string, boolean>;
  fetchMessages: (hpid: string) => Promise<ClassifiedMessages | null>;
  clearMessages: () => void;
}

// XML에서 메시지 내용 추출 (우선순위 기반: symBlkMsg > msg > hviMsg > dissMsg > symOutDspMsg)
function extractMsgContent(itemXml: string): string {
  const msgTags = ['symBlkMsg', 'msg', 'hviMsg', 'dissMsg', 'symOutDspMsg'];

  for (const tag of msgTags) {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
    const match = itemXml.match(regex);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  }

  return '';
}

// XML 파싱 헬퍼
function parseXmlItems(xmlText: string): EmergencyMessage[] {
  const items: EmergencyMessage[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    const msg = extractMsgContent(itemXml);
    const symTypCod = itemXml.match(/<symTypCod>([^<]*)<\/symTypCod>/i)?.[1] || '';
    const symTypCodMag = itemXml.match(/<symTypCodMag>([^<]*)<\/symTypCodMag>/i)?.[1] || '';
    const symBlkMsgTyp = itemXml.match(/<symBlkMsgTyp>([^<]*)<\/symBlkMsgTyp>/i)?.[1] || '';
    const rnum = itemXml.match(/<rnum>([^<]*)<\/rnum>/i)?.[1] || '';

    if (msg) {
      items.push({ msg, symTypCod, symTypCodMag, symBlkMsgTyp, rnum });
    }
  }

  return items;
}

// 질환명 포맷 변환 (예: "뇌출혈수술(거미막하 출혈 외)" -> "[뇌출혈] 거미막하출혈 외")
function formatDiseaseName(symTypCodMag: string): string {
  if (!symTypCodMag) return '';

  // "뇌출혈수술(거미막하 출혈 외)" -> "[뇌출혈] 거미막하출혈 외"
  // "뇌출혈수술(거미막하 출혈)" -> "[뇌출혈] 거미막하출혈"
  // "뇌경색의 재관류중재술" -> "[뇌경색] 재관류중재술"

  const patterns = [
    { regex: /뇌출혈수술\(거미막하\s*출혈\s*외\)/i, result: '[뇌출혈] 거미막하출혈 외' },
    { regex: /뇌출혈수술\(거미막하\s*출혈\)/i, result: '[뇌출혈] 거미막하출혈' },
    { regex: /뇌경색의\s*재관류중재술/i, result: '[뇌경색] 재관류중재술' },
    { regex: /대동맥수술/i, result: '[대동맥] 수술' },
    { regex: /응급실/i, result: '[응급실]' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(symTypCodMag)) {
      return pattern.result;
    }
  }

  // 기본적으로 괄호 형식이면 변환
  const match = symTypCodMag.match(/^(.+?)[의수술]*\((.+)\)$/);
  if (match) {
    const category = match[1].replace(/수술$/, '').trim();
    const detail = match[2].replace(/\s+/g, '').trim();
    return `[${category}] ${detail}`;
  }

  return symTypCodMag;
}

// 메시지 분류
function classifyMessages(items: EmergencyMessage[]): ClassifiedMessages {
  const emergency: Array<{ msg: string; symTypCod: string }> = [];
  const diseaseMessages: Array<{
    category: string;
    subcategory: string;
    displayName: string;
    content: string;
  }> = [];

  items.forEach((item) => {
    const { msg, symTypCod, symTypCodMag, symBlkMsgTyp } = item;

    // 중증질환 메시지 (symBlkMsgTyp이 "중증"이거나 symTypCodMag이 있는 경우)
    if (symBlkMsgTyp === '중증' || (symTypCodMag && symTypCod && symTypCod !== 'Y000')) {
      // symTypCodMag을 포맷된 질환명으로 변환
      const displayName = formatDiseaseName(symTypCodMag) || symTypCodMag || '[중증질환]';

      // [카테고리] 세부명 형식 파싱
      const labelMatch = displayName.match(/\[([^\]]+)\]\s*(.*)/);
      const category = labelMatch ? `[${labelMatch[1]}]` : '[중증질환]';
      const subcategory = labelMatch ? labelMatch[2] : displayName;

      diseaseMessages.push({
        category,
        subcategory,
        displayName,
        content: msg  // 실제 메시지 내용
      });
    } else {
      // 응급실 메시지
      emergency.push({ msg, symTypCod: symTypCod || '' });
    }
  });

  return {
    emergency,
    disease: diseaseMessages.length > 0 ? diseaseMessages[0] : null,
    allDiseases: diseaseMessages
  };
}

export function useEmergencyMessages(): UseEmergencyMessagesReturn {
  const [messages, setMessages] = useState<Map<string, ClassifiedMessages>>(new Map());
  const [loading, setLoading] = useState<Map<string, boolean>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const fetchMessages = useCallback(async (hpid: string): Promise<ClassifiedMessages | null> => {
    // 유효한 hpid 확인
    if (!hpid || typeof hpid !== 'string') {
      console.warn('[EmergencyMessages] 유효하지 않은 hpid:', hpid);
      return null;
    }

    // 이미 로딩 중이면 스킵
    if (loading.get(hpid)) {
      return messages.get(hpid) || null;
    }

    // 캐시 확인
    if (messages.has(hpid)) {
      return messages.get(hpid) || null;
    }

    // 로딩 상태 설정
    setLoading((prev) => new Map(prev).set(hpid, true));

    try {
      console.log(`[EmergencyMessages] 조회 시작: ${hpid}`);

      // 기존 요청이 있으면 취소
      const existingController = abortControllersRef.current.get(hpid);
      if (existingController) {
        console.log(`[EmergencyMessages] 기존 요청 취소: ${hpid}`);
        existingController.abort();
      }

      // AbortController로 타임아웃 설정 (10초)
      const controller = new AbortController();
      abortControllersRef.current.set(hpid, controller);
      const timeoutId = setTimeout(() => {
        controller.abort();
        abortControllersRef.current.delete(hpid);
      }, 10000);

      const response = await fetch(`/api/emergency-messages?hpid=${encodeURIComponent(hpid)}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/xml' }
      });

      clearTimeout(timeoutId);
      abortControllersRef.current.delete(hpid);

      if (!response.ok) {
        console.warn(`[EmergencyMessages] HTTP 경고: ${response.status}`, response.statusText);
        // HTTP 에러여도 빈 결과로 저장하고 계속 진행
      }

      const xmlText = await response.text();
      console.log(`[EmergencyMessages] XML 수신 길이: ${xmlText.length}`);
      const items = parseXmlItems(xmlText);
      const classified = classifyMessages(items);

      // 결과 저장
      setMessages((prev) => new Map(prev).set(hpid, classified));
      setLoading((prev) => new Map(prev).set(hpid, false));

      console.log(`[EmergencyMessages] 조회 완료: ${hpid}, 메시지 수: ${items.length}`);
      return classified;
    } catch (error) {
      // 요청 중단은 무시 (타임아웃 시에도)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[EmergencyMessages] 요청 중단됨: ${hpid}`);
      } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn(`[EmergencyMessages] 네트워크 오류: ${hpid}`, error.message);
      } else {
        console.error(`[EmergencyMessages] ${hpid} 조회 오류:`, error);
      }

      abortControllersRef.current.delete(hpid);
      setLoading((prev) => new Map(prev).set(hpid, false));

      // 빈 결과 저장 (재시도 방지)
      const emptyResult: ClassifiedMessages = { emergency: [], disease: null, allDiseases: [] };
      setMessages((prev) => new Map(prev).set(hpid, emptyResult));

      return null;
    }
  }, [loading, messages]);

  const clearMessages = useCallback(() => {
    setMessages(new Map());
    setLoading(new Map());
  }, []);

  // Cleanup: 언마운트 시 모든 진행 중인 요청 취소
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach(controller => {
        controller.abort();
      });
      abortControllersRef.current.clear();
    };
  }, []);

  return {
    messages,
    loading,
    fetchMessages,
    clearMessages
  };
}
