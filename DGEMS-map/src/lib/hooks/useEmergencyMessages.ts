/**
 * 응급 메시지 데이터 훅
 * 병원별 응급실 및 중증질환 메시지 조회
 */

import { useState, useCallback } from 'react';
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
  const diseaseMessages: Array<{ displayName: string; content: string; symTypCod: string }> = [];

  items.forEach((item) => {
    const { msg, symTypCod } = item;

    // symTypCod가 있으면 중증질환 관련 메시지
    if (symTypCod) {
      // S001 ~ S027 형식의 코드를 MKioskTy1 ~ MKioskTy27로 변환
      const diseaseNum = symTypCod.replace(/^S0?/, '');
      const severeType = SEVERE_TYPES.find((t) => t.key === `MKioskTy${diseaseNum}`);

      if (severeType) {
        diseaseMessages.push({
          displayName: severeType.label,
          content: msg,
          symTypCod
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

  const fetchMessages = useCallback(async (hpid: string): Promise<ClassifiedMessages | null> => {
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
      const response = await fetch(`/api/emergency-messages?hpid=${encodeURIComponent(hpid)}`);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const xmlText = await response.text();
      const items = parseXmlItems(xmlText);
      const classified = classifyMessages(items);

      // 결과 저장
      setMessages((prev) => new Map(prev).set(hpid, classified));
      setLoading((prev) => new Map(prev).set(hpid, false));

      return classified;
    } catch (error) {
      console.error(`[EmergencyMessages] ${hpid} 조회 오류:`, error);
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

  return {
    messages,
    loading,
    fetchMessages,
    clearMessages
  };
}
