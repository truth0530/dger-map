# 응급실 메시지 API 진료과목 필드 분석 보고서

> 작성일: 2025-12-28
> 작성자: Claude Code
> 상태: 공공데이터포털 개선요청 제출 완료, API 업데이트 대기 중

---

## 1. 개요

### 1.1 문제 발견
NEMC(중앙응급의료센터) 시스템에서는 진료과목(안과, 치과, 혈관외과 등)을 **카테고리로 선택**하여 메시지를 등록할 수 있으나, 공공데이터 API 응답에는 해당 진료과목 정보가 포함되지 않음.

### 1.2 영향
- 칠곡경북대학교병원 등에서 "응급진료 불가" 메시지의 진료과목 정보 누락
- 응급환자 이송 시 정확한 진료과 불가 정보 전달 불가

---

## 2. 현재 API 구조 분석

### 2.1 API 엔드포인트
- **API명**: 국립중앙의료원_전국 응급의료기관 정보 조회 서비스
- **오퍼레이션**: getEmrrmRltmUsefulSckbdInfoInqire (응급실메시지정보조회)
- **공공데이터포털**: https://www.data.go.kr/data/15000563/openapi.do

### 2.2 현재 응답 필드 (13개)

| 필드명 | 설명 | 예시 |
|--------|------|------|
| dutyAddr | 병원 주소 | 대구광역시 북구 호국로 807 |
| dutyName | 병원명 | 칠곡경북대학교병원 |
| emcOrgCod | 기관코드 | A1300010 |
| hpid | 병원ID | A1300010 |
| rnum | 순번 | 1 |
| symBlkEndDtm | 메시지 종료일시 | 20251229082900 |
| **symBlkMsg** | **메시지 내용** | 응급진료 불가 |
| symBlkMsgTyp | 메시지 타입 | 응급 / 중증 |
| symBlkSttDtm | 메시지 시작일시 | 20251226173000 |
| symOutDspMth | 표시방법 | 자동 |
| symOutDspYon | 차단여부 | 차단 |
| symTypCod | 증상코드 | Y000, Y0020 등 |
| symTypCodMag | 증상코드명 | 응급실, 뇌경색의 재관류중재술 등 |

### 2.3 진료과목 관련 필드
**현재 API에 진료과목 전용 필드 없음**

---

## 3. NEMC 시스템 입력 구조 분석

### 3.1 메시지 입력 화면 구조
NEMC 시스템(mediboard.nemc.or.kr)의 메시지 등록 화면은 다음과 같은 계층 구조로 구성됨:

```
메세지 타입: ○ 전체 ○ 중증응급질환메세지 ● 응급실 메세지
질환/수술(시술)명: ==전체== (드롭다운)

진료분류: ● 내과계열 ○ 외과계열 ○ 기타진료 ○ 응급실 ○ 병상 또는 장비
진료과: [드롭다운 선택]
사유: [드롭다운 선택]
메세지(기타): [자유 입력 텍스트]
```

### 3.2 진료분류별 상세 구조

#### 3.2.1 내과계열
| 진료과 | 사유 옵션 |
|--------|----------|
| 소아청소년과 | 의료진 부족/부재 |
| 신경과 | 수술/시술 중 |
| 순환기내과 | 신환 수용불가 |
| 호흡기내과 | 특정 시간 불가 |
| 소화기내과 | 특정 연령 및 특정 체중 미만 불가 |
| 신장내과 | |
| 감염내과 | |
| 혈액·종양내과 | |
| 내분비내과 | |
| 류마티스내과 | |

#### 3.2.2 외과계열
| 진료과 | 사유 옵션 |
|--------|----------|
| 외과 | 의료진 부족/부재 |
| 산부인과 | 수술/시술 중 |
| 신경외과 | 신환 수용불가 |
| 흉부외과 | 특정 시간 불가 |
| 정형외과 | 특정 주수 or 쌍둥이(twin) or 특정 체중 미만 불가 |
| 성형외과 | |
| **안과** | |
| 이비인후과 | |
| 비뇨의학과 | |
| 외상외과 | |

#### 3.2.3 기타진료
| 진료과 | 사유 옵션 |
|--------|----------|
| 피부과 | 의료진 부족/부재 |
| **치과** | 수술/시술 중 |
| 마취통증의학과 | 신환 수용불가 |
| 영상의학과 | 특정 시간 불가 |
| 재활의학과 | |
| 가정의학과 | |
| 정신건강의학과 | |
| 기타 진료과 | |

#### 3.2.4 응급실
| 진료과 | 사유 옵션 |
|--------|----------|
| 응급실 | 응급실 포화 |
| | 중환자 포화 |
| | 사전협의 필요 |
| | 장시간 대기 필요 |

#### 3.2.5 병상 또는 장비
| 진료과 | 사유 옵션 |
|--------|----------|
| 병상 또는 장비 | 병실 부족 |
| | 중환자실 부족 |
| | 수술실 부족 |
| | 격리실 부족 |
| | 장비 점검·고장 또는 부족 |
| | 전산시스템 장애 |

### 3.3 NEMC 시스템 데이터 저장 형식
실제 저장 시 다음과 같은 형식으로 분류됨:
```
응급의료기관분류: 외과계열>산부인과
사유: 신환 수용불가
```

### 3.4 API 응답과의 비교

| 병원 | NEMC 시스템 표시 | API 응답 (symBlkMsg) |
|------|------------------|---------------------|
| 칠곡경북대 | [안과] 응급진료 불가 | 응급진료 불가 |
| 칠곡경북대 | [치과] 응급진료 불가 | 응급진료 불가 |
| 칠곡경북대 | [혈관외과] 응급진료 불가 | [혈관외과] 응급진료 불가 ✅ |
| 대구파티마 | [안과] 망막 등... | [안과]망막 등... ✅ |

**결론**: 진료과목을 메시지 텍스트에 직접 입력한 경우만 API에서 확인 가능

---

## 4. 실제 API 응답 예시

### 4.1 진료과목 정보 있는 경우 (메시지에 포함)
```xml
<item>
  <dutyName>대구파티마병원</dutyName>
  <hpid>A1300009</hpid>
  <symBlkMsg>[안과]망막 등 응급수술 필요한 환자 이송전 문의</symBlkMsg>
  <symBlkMsgTyp>응급</symBlkMsgTyp>
  <symTypCod>Y000</symTypCod>
  <symTypCodMag>응급실</symTypCodMag>
</item>
```

### 4.2 진료과목 정보 없는 경우 (카테고리로만 선택)
```xml
<item>
  <dutyName>칠곡경북대학교병원</dutyName>
  <hpid>A1300010</hpid>
  <symBlkMsg>응급진료 불가</symBlkMsg>
  <symBlkMsgTyp>응급</symBlkMsgTyp>
  <symTypCod>Y000</symTypCod>
  <symTypCodMag>응급실</symTypCodMag>
  <!-- 진료과목(안과/치과 등) 정보 없음 -->
</item>
```

---

## 5. 개선 요청 사항

### 5.1 요청 내용
API 응답에 진료분류, 진료과목, 사유 필드 추가 요청

### 5.2 제안 필드명
```xml
<!-- 진료분류 (내과계열/외과계열/기타진료/응급실/병상또는장비) -->
<symDeptCat>외과계열</symDeptCat>

<!-- 진료과목 (안과/치과/신경외과 등) -->
<symDeptNm>안과</symDeptNm>

<!-- 사유 (의료진 부족/부재, 신환 수용불가 등) -->
<symReason>신환 수용불가</symReason>
```

### 5.3 기대 응답 구조 (전체)
```xml
<item>
  <dutyName>칠곡경북대학교병원</dutyName>
  <hpid>A1300010</hpid>
  <symBlkMsg>응급진료 불가</symBlkMsg>
  <symBlkMsgTyp>응급</symBlkMsgTyp>
  <symTypCod>Y000</symTypCod>
  <symTypCodMag>응급실</symTypCodMag>
  <!-- 신규 필드 -->
  <symDeptCat>외과계열</symDeptCat>
  <symDeptNm>안과</symDeptNm>
  <symReason>신환 수용불가</symReason>
</item>
```

### 5.4 최소 요청 (진료과목만)
```xml
<item>
  ...
  <symDeptNm>안과</symDeptNm>  <!-- 최소한 이 필드만이라도 추가 요청 -->
</item>
```

---

## 6. API 업데이트 시 적용 가이드

### 6.1 수정 대상 파일
```
/src/lib/hooks/useEmergencyMessages.ts
```

### 6.2 현재 코드 (parseXmlItems 함수)
```typescript
// 현재: 진료과목 필드 없음
function parseXmlItems(xmlText: string): EmergencyMessage[] {
  // ...
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
  // ...
}
```

### 6.3 API 업데이트 후 수정 코드
```typescript
// EmergencyMessage 인터페이스에 필드 추가
export interface EmergencyMessage {
  msg: string;
  symTypCod: string;
  symTypCodMag: string;
  symBlkMsgTyp: string;
  rnum?: string;
  // 신규 필드 (API 제공 시 활성화)
  symDeptCat?: string;   // 진료분류 (내과계열/외과계열/기타진료/응급실/병상또는장비)
  symDeptNm?: string;    // 진료과목 (안과/치과/신경외과 등)
  symReason?: string;    // 사유 (의료진 부족/부재, 신환 수용불가 등)
}

// parseXmlItems 함수 수정
function parseXmlItems(xmlText: string): EmergencyMessage[] {
  // ...
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    const msg = extractMsgContent(itemXml);
    const symTypCod = itemXml.match(/<symTypCod>([^<]*)<\/symTypCod>/i)?.[1] || '';
    const symTypCodMag = itemXml.match(/<symTypCodMag>([^<]*)<\/symTypCodMag>/i)?.[1] || '';
    const symBlkMsgTyp = itemXml.match(/<symBlkMsgTyp>([^<]*)<\/symBlkMsgTyp>/i)?.[1] || '';
    const rnum = itemXml.match(/<rnum>([^<]*)<\/rnum>/i)?.[1] || '';

    // 신규 필드 추출 (API 제공 시 활성화)
    const symDeptCat = itemXml.match(/<symDeptCat>([^<]*)<\/symDeptCat>/i)?.[1] || '';
    const symDeptNm = itemXml.match(/<symDeptNm>([^<]*)<\/symDeptNm>/i)?.[1] || '';
    const symReason = itemXml.match(/<symReason>([^<]*)<\/symReason>/i)?.[1] || '';

    if (msg) {
      items.push({
        msg, symTypCod, symTypCodMag, symBlkMsgTyp, rnum,
        symDeptCat, symDeptNm, symReason
      });
    }
  }
  // ...
}
```

### 6.4 메시지 표시 로직 수정
```typescript
// classifyMessages 함수에서 진료과목 접두사 추가
function classifyMessages(items: EmergencyMessage[]): ClassifiedMessages {
  // ...
  items.forEach((item) => {
    let displayMsg = item.msg;

    // API에서 진료과목 필드가 제공되고, 메시지에 접두사가 없는 경우
    if (item.symDeptNm && !item.msg.startsWith('[')) {
      displayMsg = `[${item.symDeptNm}] ${item.msg}`;
    }

    // 사유 필드가 별도로 제공되는 경우 활용 가능
    // 예: displayMsg = `[${item.symDeptNm}] ${item.symReason}`;

    // ...
  });
  // ...
}
```

### 6.5 진료분류별 색상 적용 (선택사항)
```typescript
// 진료분류(symDeptCat)에 따른 색상 구분
function getDeptCategoryColor(deptCat: string): string {
  switch (deptCat) {
    case '내과계열': return 'text-blue-400';
    case '외과계열': return 'text-green-400';
    case '기타진료': return 'text-purple-400';
    case '응급실': return 'text-red-400';
    case '병상 또는 장비': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
}
```

---

## 7. 검증 체크리스트

API 업데이트 후 다음 항목 검증 필요:

### 7.1 API 응답 확인
- [ ] 새로운 필드명 확인 (symDeptCat, symDeptNm, symReason 또는 다른 명칭)
- [ ] 필드값 형식 확인 (한글/코드/영문)
- [ ] 모든 진료분류에 대해 값이 제공되는지 확인

### 7.2 코드 수정
- [ ] EmergencyMessage 인터페이스 업데이트
- [ ] parseXmlItems 함수에 신규 필드 추출 코드 추가
- [ ] classifyMessages 함수에서 진료과목 접두사 처리
- [ ] 기존 메시지 (텍스트에 진료과목 포함된 경우) 중복 표시 방지

### 7.3 테스트
- [ ] 칠곡경북대병원 안과/치과 메시지 표시 확인
- [ ] 대구파티마병원 등 기존 [진료과목] 형식 메시지 정상 표시 확인
- [ ] 빌드 성공 확인
- [ ] 실제 서비스 동작 테스트

---

## 8. 참고 자료

### 8.1 NEMC 시스템 URL
- 메디보드: https://mediboard.nemc.or.kr/operational_board_detail

### 8.2 공공데이터포털
- API 상세페이지: https://www.data.go.kr/data/15000563/openapi.do
- 데이터 개선요청: https://www.data.go.kr (로그인 후 해당 API 페이지에서 요청)

### 8.3 관련 코드 파일
- 메시지 파싱: `/src/lib/hooks/useEmergencyMessages.ts`
- 메시지 분류: `/src/lib/utils/messageClassifier.ts`
- 메시지 표시: `/src/app/page.tsx`

---

## 9. 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-28 | 문제 발견 및 API 필드 분석 완료 (13개 필드 확인) |
| 2025-12-28 | NEMC 시스템 입력 구조 분석 (진료분류 5개, 진료과 40개+, 사유 옵션) |
| 2025-12-28 | 공공데이터포털 데이터 개선요청 제출 |
| - | API 업데이트 대기 중 |
| - | (예정) API 업데이트 확인 및 코드 적용 |
