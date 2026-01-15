# 중증질환 API 필드 매핑 문서

> 작성일: 2025-01-15
> 작성자: Claude Code
> 목적: 중증질환 관련 API 필드 간 매핑 관계 명확화

---

## 1. 개요

중증질환 데이터를 다루는 두 개의 독립적인 API가 있으며, 각각 다른 필드 체계를 사용합니다.
이 문서는 두 API 간의 필드 매핑 관계를 명확히 정의합니다.

### 1.1 관련 API

| API | 엔드포인트 | 용도 |
|-----|-----------|------|
| 수용가능 현황 API | `getSrsillDissAceptncPosblInfoInqire` | 병원별 27개 질환의 Y/불가능/정보미제공 상태 |
| 응급메시지 API | `getEmrrmSrsillDissMsgInqire` | 병원별 불가 메시지 상세 내용 |

### 1.2 핵심 매핑 관계

```
MKioskTy{N} (수용가능 API) ←→ qn (UI 질환번호) ←→ symTypCod (응급메시지 API)
```

**중요**: 두 API는 독립적이며, 동일한 질환을 다른 필드명으로 식별합니다.

---

## 2. 수용가능 현황 API (getSrsillDissAceptncPosblInfoInqire)

### 2.1 질환 상태 필드

27개 질환의 수용 가능 여부를 `MKioskTy1` ~ `MKioskTy27` 필드로 제공합니다.

```xml
<item>
  <hpid>A1300010</hpid>
  <dutyName>칠곡경북대학교병원</dutyName>
  <MKioskTy1>불가능</MKioskTy1>   <!-- 심근경색 재관류중재술 -->
  <MKioskTy2>불가능</MKioskTy2>   <!-- 뇌경색 재관류중재술 -->
  <MKioskTy10>불가능</MKioskTy10> <!-- 장중첩/폐색(영유아) -->
  ...
</item>
```

### 2.2 MKioskTy 필드 목록

| 필드 | qn | 질환명 |
|------|-----|--------|
| MKioskTy1 | 1 | [재관류중재술] 심근경색 |
| MKioskTy2 | 2 | [재관류중재술] 뇌경색 |
| MKioskTy3 | 3 | [뇌출혈수술] 거미막하출혈 |
| MKioskTy4 | 4 | [뇌출혈수술] 거미막하출혈 외 |
| MKioskTy5 | 5 | [대동맥응급] 흉부 |
| MKioskTy6 | 6 | [대동맥응급] 복부 |
| MKioskTy7 | 7 | [담낭담관질환] 담낭질환 |
| MKioskTy8 | 8 | [담낭담관질환] 담도포함질환 |
| MKioskTy9 | 9 | [복부응급수술] 비외상 |
| MKioskTy10 | 10 | [장중첩/폐색] 영유아 |
| MKioskTy11 | 11 | [응급내시경] 성인 위장관 |
| MKioskTy12 | 12 | [응급내시경] 영유아 위장관 |
| MKioskTy13 | 13 | [응급내시경] 성인 기관지 |
| MKioskTy14 | 14 | [응급내시경] 영유아 기관지 |
| MKioskTy15 | 15 | [저체중출생아] 집중치료 |
| MKioskTy16 | 16 | [산부인과응급] 분만 |
| MKioskTy17 | 17 | [산부인과응급] 산과수술 |
| MKioskTy18 | 18 | [산부인과응급] 부인과수술 |
| MKioskTy19 | 19 | [중증화상] 전문치료 |
| MKioskTy20 | 20 | [사지접합] 수족지접합 |
| MKioskTy21 | 21 | [사지접합] 수족지접합 외 |
| MKioskTy22 | 22 | [응급투석] HD |
| MKioskTy23 | 23 | [응급투석] CRRT |
| MKioskTy24 | 24 | [정신과적응급] 폐쇄병동입원 |
| MKioskTy25 | 25 | [안과적수술] 응급 |
| MKioskTy26 | 26 | [영상의학혈관중재] 성인 |
| MKioskTy27 | 27 | [영상의학혈관중재] 영유아 |

---

## 3. 응급메시지 API (getEmrrmSrsillDissMsgInqire)

### 3.1 메시지 응답 구조

```xml
<item>
  <hpid>A1300010</hpid>
  <dutyName>칠곡경북대학교병원</dutyName>
  <symTypCod>Y0010</symTypCod>                        <!-- 질환 코드 -->
  <symTypCodMag>심근경색의 재관류중재술</symTypCodMag>  <!-- 질환명 텍스트 -->
  <symBlkMsg>평일 야간, 주말 불가</symBlkMsg>          <!-- 불가 메시지 -->
  <symBlkMsgTyp>중증</symBlkMsgTyp>                   <!-- 메시지 타입 -->
  <symBlkSttDtm>20260115173000</symBlkSttDtm>         <!-- 시작일시 -->
  <symBlkEndDtm>20260116075900</symBlkEndDtm>         <!-- 종료일시 -->
</item>
```

### 3.2 symTypCod → qn 매핑 테이블

**이 매핑이 핵심입니다.** `symTypCod` 값을 사용하여 어떤 질환의 메시지인지 식별합니다.

| symTypCod | qn | 질환명 (symTypCodMag) |
|-----------|-----|----------------------|
| Y0010 | 1 | 심근경색의 재관류중재술 |
| Y0020 | 2 | 뇌경색의 재관류중재술 |
| Y0031 | 3 | 뇌출혈수술 거미막하출혈 |
| Y0032 | 4 | 뇌출혈수술 거미막하출혈 외 |
| Y0041 | 5 | 대동맥응급 흉부 |
| Y0042 | 6 | 대동맥응급 복부 |
| Y0051 | 7 | 담낭담관질환 담낭질환 |
| Y0052 | 8 | 담낭담관질환 담도포함질환 |
| Y0060 | 9 | 복부응급수술 비외상 |
| Y0070 | 10 | 장중첩/폐색(유아) |
| Y0081 | 11 | 위장관 응급내시경(성인) |
| Y0082 | 12 | 위장관 응급내시경(영유아) |
| Y0091 | 13 | 기관지 응급내시경(성인) |
| Y0092 | 14 | 기관지 응급내시경(영유아) |
| Y0100 | 15 | 저체중출생아 집중치료 |
| Y0111 | 16 | 산부인과응급 분만 |
| Y0112 | 17 | 산부인과응급 산과수술 |
| Y0113 | 18 | 산부인과응급 부인과수술 |
| Y0120 | 19 | 중증화상 전문치료 |
| Y0131 | 20 | 사지접합 수족지접합 |
| Y0132 | 21 | 사지접합 수족지접합 외 |
| Y0141 | 22 | 응급투석 HD |
| Y0142 | 23 | 응급투석 CRRT |
| Y0150 | 24 | 정신과적응급 폐쇄병동입원 |
| Y0160 | 25 | 안과적수술 응급 |
| Y0171 | 26 | 영상의학혈관중재 성인 |
| Y0172 | 27 | 영상의학혈관중재 영유아 |
| Y000 | - | 응급실 (일반 메시지, 질환 특정 아님) |

### 3.3 특수 코드

| symTypCod | 설명 |
|-----------|------|
| Y000 | 응급실 일반 메시지 (특정 질환과 무관) |

---

## 4. 코드 내 매핑 구현

### 4.1 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/constants/diseasePatterns.ts` | `SYMPTOM_CODE_TO_DISEASE_MAP` 정의 |
| `src/lib/constants/dger.ts` | `SEVERE_TYPES` (MKioskTy 필드 정의) |
| `src/app/severe/page.tsx` | 메시지 필터링 로직 |

### 4.2 SYMPTOM_CODE_TO_DISEASE_MAP 사용법

```typescript
import { SYMPTOM_CODE_TO_DISEASE_MAP } from '@/lib/constants/diseasePatterns';

// symTypCod를 qn으로 변환
const symTypCod = 'Y0010';  // API 응답에서 추출
const qn = SYMPTOM_CODE_TO_DISEASE_MAP[symTypCod];  // 결과: 1 (심근경색)

// 메시지 필터링 예시
const filterMessagesByDisease = (messages: MessageItem[], qn: number): MessageItem[] => {
  return messages.filter(msg => {
    const mappedQn = SYMPTOM_CODE_TO_DISEASE_MAP[msg.symTypCod];
    return mappedQn === qn;
  });
};
```

---

## 5. 통합 매핑 테이블 (전체)

| qn | MKioskTy | symTypCod | 질환명 |
|----|----------|-----------|--------|
| 1 | MKioskTy1 | Y0010 | [재관류중재술] 심근경색 |
| 2 | MKioskTy2 | Y0020 | [재관류중재술] 뇌경색 |
| 3 | MKioskTy3 | Y0031 | [뇌출혈수술] 거미막하출혈 |
| 4 | MKioskTy4 | Y0032 | [뇌출혈수술] 거미막하출혈 외 |
| 5 | MKioskTy5 | Y0041 | [대동맥응급] 흉부 |
| 6 | MKioskTy6 | Y0042 | [대동맥응급] 복부 |
| 7 | MKioskTy7 | Y0051 | [담낭담관질환] 담낭질환 |
| 8 | MKioskTy8 | Y0052 | [담낭담관질환] 담도포함질환 |
| 9 | MKioskTy9 | Y0060 | [복부응급수술] 비외상 |
| 10 | MKioskTy10 | Y0070 | [장중첩/폐색] 영유아 |
| 11 | MKioskTy11 | Y0081 | [응급내시경] 성인 위장관 |
| 12 | MKioskTy12 | Y0082 | [응급내시경] 영유아 위장관 |
| 13 | MKioskTy13 | Y0091 | [응급내시경] 성인 기관지 |
| 14 | MKioskTy14 | Y0092 | [응급내시경] 영유아 기관지 |
| 15 | MKioskTy15 | Y0100 | [저체중출생아] 집중치료 |
| 16 | MKioskTy16 | Y0111 | [산부인과응급] 분만 |
| 17 | MKioskTy17 | Y0112 | [산부인과응급] 산과수술 |
| 18 | MKioskTy18 | Y0113 | [산부인과응급] 부인과수술 |
| 19 | MKioskTy19 | Y0120 | [중증화상] 전문치료 |
| 20 | MKioskTy20 | Y0131 | [사지접합] 수족지접합 |
| 21 | MKioskTy21 | Y0132 | [사지접합] 수족지접합 외 |
| 22 | MKioskTy22 | Y0141 | [응급투석] HD |
| 23 | MKioskTy23 | Y0142 | [응급투석] CRRT |
| 24 | MKioskTy24 | Y0150 | [정신과적응급] 폐쇄병동입원 |
| 25 | MKioskTy25 | Y0160 | [안과적수술] 응급 |
| 26 | MKioskTy26 | Y0171 | [영상의학혈관중재] 성인 |
| 27 | MKioskTy27 | Y0172 | [영상의학혈관중재] 영유아 |

---

## 6. 주의사항

### 6.1 두 API는 독립적

- **수용가능 API**: 병원의 현재 수용 상태 (Y/불가능/정보미제공)
- **응급메시지 API**: 병원이 등록한 불가 사유 메시지

두 API의 데이터는 독립적으로 관리되며, 반드시 일치하지 않을 수 있습니다.
예: 수용가능 API에서 "불가능"이어도 응급메시지 API에 해당 질환 메시지가 없을 수 있음

### 6.2 메시지 필터링 시 주의

응급메시지를 질환별로 필터링할 때는 반드시 `symTypCod`를 사용하여 `SYMPTOM_CODE_TO_DISEASE_MAP`으로 변환해야 합니다.

```typescript
// ❌ 잘못된 방법: 텍스트 기반 필터링
messages.filter(msg => msg.symTypCodMag.includes('심근경색'));

// ✅ 올바른 방법: symTypCod → qn 매핑 사용
messages.filter(msg => SYMPTOM_CODE_TO_DISEASE_MAP[msg.symTypCod] === qn);
```

### 6.3 Y000 코드 처리

`symTypCod`가 `Y000`인 메시지는 응급실 일반 메시지로, 특정 질환과 연결되지 않습니다.
질환별 필터링 시 이 메시지는 제외됩니다.

---

## 7. API 테스트 URL

### 7.1 수용가능 현황 조회
```
https://apis.data.go.kr/B552657/ErmctInfoInqireService/getSrsillDissAceptncPosblInfoInqire
?serviceKey={API_KEY}
&STAGE1=대구광역시
&numOfRows=100
&pageNo=1
```

### 7.2 응급메시지 조회
```
https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmSrsillDissMsgInqire
?serviceKey={API_KEY}
&HPID=A1300010
&numOfRows=1000
&pageNo=1
```

---

## 8. 수정 이력

| 날짜 | 내용 |
|------|------|
| 2025-01-15 | 문서 작성 - symTypCod ↔ qn ↔ MKioskTy 매핑 관계 정의 |
