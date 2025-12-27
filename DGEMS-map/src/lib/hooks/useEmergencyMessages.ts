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
  rnum?: string;
}

interface UseEmergencyMessagesReturn {
  messages: Map<string, ClassifiedMessages>;
  loading: Map<string, boolean>;
  fetchMessages: (hpid: string) => Promise<ClassifiedMessages | null>;
  clearMessages: () => void;
}

// XML 파싱 헬퍼
function parseXmlItems(xmlText: string): EmergencyMessage[] {
  const items: EmergencyMessage[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    const msg = itemXml.match(/<symBlkMsg>([^<]*)<\/symBlkMsg>/i)?.[1] || '';
    const symTypCod = itemXml.match(/<symTypCod>([^<]*)<\/symTypCod>/i)?.[1] || '';
    const rnum = itemXml.match(/<rnum>([^<]*)<\/rnum>/i)?.[1] || '';

    if (msg) {
      items.push({ msg, symTypCod, rnum });
    }
  }

  return items;
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
    const { msg, symTypCod } = item;

    // symTypCod가 있으면 중증질환 관련 메시지
    if (symTypCod) {
      // S001 ~ S027 형식의 코드를 MKioskTy1 ~ MKioskTy27로 변환
      const diseaseNum = symTypCod.replace(/^S0?/, '');
      const severeType = SEVERE_TYPES.find((t) => t.key === `MKioskTy${diseaseNum}`);

      if (severeType) {
        // [카테고리] 세부명 형식 파싱
        const labelMatch = severeType.label.match(/\[([^\]]+)\]\s*(.*)/);
        const category = labelMatch ? `[${labelMatch[1]}]` : '[기타]';
        const subcategory = labelMatch ? labelMatch[2] : severeType.label;

        diseaseMessages.push({
          category,
          subcategory,
          displayName: severeType.label,
          content: msg
        });
      } else {
        // 알 수 없는 코드는 응급실 메시지로 처리
        emergency.push({ msg, symTypCod });
      }
    } else {
      // symTypCod가 없으면 응급실 메시지
      emergency.push({ msg, symTypCod: '' });
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
