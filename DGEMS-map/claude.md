# DGEMS-map 프로젝트 계획서

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | DGEMS-map |
| 프로젝트 경로 | C:\project\DGEMS-map\ |
| 목적 | 44개 중증응급질환의 요일별 제공가능 정보를 한국 지도에 시각화 |
| UI 참조 | AEDpics 프로젝트의 지도 탭 UI/디자인 복제 |
| 기술 스택 | Next.js 14, React 18, TypeScript, Tailwind CSS |

---

## 2. 데이터 소스

### 2.1 구글시트 데이터
- **내용**: 44개 중증응급질환에 대한 요일별 제공가능 정보
- **상태**: 구조 확인 필요 (Playwright MCP로 브라우저 열어 확인 예정)

### 2.2 확인 필요 사항
- [ ] 지역 구분 방식 (시도별? 구군별? 병원별?)
- [ ] 44개 중증응급질환 목록
- [ ] 요일별 데이터 형태 (월~일? 평일/주말?)
- [ ] "제공가능" 정보의 형태 (O/X? 숫자? 병원 수?)
- [ ] 구글시트 연동 방식 (API? CSV 내보내기?)

---

## 3. 복제 대상 (AEDpics 프로젝트)

### 3.1 컴포넌트
| 원본 파일 | 라인 수 | 핵심 기능 |
|----------|--------|----------|
| components/dashboard/KoreaSidoMap.tsx | 384줄 | 전국 17개 시도 SVG 지도, 히트맵, 호버 툴팁 |
| components/dashboard/KoreaGugunMap.tsx | 1,320줄 | 구군별 SVG 지도, 필터, 7개 지표 선택 |

### 3.2 정적 자산 (SVG 지도 파일)
경로: `public/maps/sigungu/` (18개 파일)
- 서울특별시_시군구_경계.svg
- 부산광역시_시군구_경계.svg
- 대구광역시_시군구_경계.svg
- 인천광역시_시군구_경계.svg
- 광주광역시_시군구_경계.svg
- 대전광역시_시군구_경계.svg
- 울산광역시_시군구_경계.svg
- 세종특별자치시_시군구_경계.svg
- 경기도_시군구_경계.svg
- 강원도_시군구_경계.svg
- 충청북도_시군구_경계.svg
- 충청남도_시군구_경계.svg
- 전라북도_시군구_경계.svg
- 전라남도_시군구_경계.svg
- 경상북도_시군구_경계.svg
- 경상남도_시군구_경계.svg
- 제주특별자치도_시군구_경계.svg
- 전국_시도_경계.svg

### 3.3 유틸리티/상수
| 파일 | 필요 내용 |
|------|----------|
| lib/constants/regions.ts | REGION_CODE_TO_LABEL (시도 코드 → 한글명 변환) |
| lib/utils.ts | cn() 함수 (className 병합) |

---

## 4. 신규 프로젝트 디렉토리 구조

```
C:\project\DGEMS-map\
├── README.md
├── claude.md                    # 이 파일
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
│
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                 # 메인 대시보드 페이지
│   └── api/
│       └── data/
│           └── route.ts         # 데이터 API (구글시트 연동)
│
├── components/
│   ├── ui/
│   │   └── card.tsx             # shadcn/ui Card
│   ├── Dashboard.tsx            # 메인 대시보드 컴포넌트
│   ├── KoreaSidoMap.tsx         # 시도 지도 (복제)
│   └── KoreaGugunMap.tsx        # 구군 지도 (복제)
│
├── lib/
│   ├── utils.ts                 # cn() 유틸리티
│   └── constants/
│       └── regions.ts           # 지역 코드 상수
│
└── public/
    └── maps/
        └── sigungu/             # SVG 파일 (18개 복제)
```

---

## 5. 구현 단계

### Phase 1: 데이터 구조 확인 ⬅️ 현재 단계
1. Playwright MCP 설정
2. 구글시트 브라우저로 열기
3. 데이터 구조 파악 (칼럼, 행, 값 형태)
4. 데이터 인터페이스 설계

### Phase 2: 프로젝트 초기화
1. Next.js 14 프로젝트 초기화
2. Tailwind CSS 설정
3. shadcn/ui 초기화 및 Card 컴포넌트 추가

### Phase 3: 정적 자산 복제
1. public/maps/sigungu/ 디렉토리 생성
2. AEDpics에서 18개 SVG 파일 복제

### Phase 4: 유틸리티/상수 생성
1. lib/utils.ts - cn() 함수
2. lib/constants/regions.ts - 지역 코드 매핑

### Phase 5: 지도 컴포넌트 복제 및 수정
1. KoreaSidoMap.tsx 복제 및 수정
2. KoreaGugunMap.tsx 복제 및 수정
   - AED 종속성 제거
   - 중증응급질환 데이터 형태에 맞게 수정

### Phase 6: 데이터 레이어 구현
1. 구글시트 연동 방식 결정
2. API 라우트 생성 (app/api/data/route.ts)

### Phase 7: 메인 페이지 통합
1. Dashboard.tsx 컴포넌트 생성
2. 시도/구군 지도 통합
3. 요일별 필터 UI 추가
4. 44개 질환 선택 UI 추가

### Phase 8: 테스트 및 검증
1. 개발 서버 실행
2. 지도 렌더링 확인
3. 데이터 연동 확인

---

## 6. 다음 액션 (Playwright MCP 설정 후)

1. 사용자가 구글시트 링크 제공
2. Playwright로 브라우저 열기
3. 구글시트 데이터 구조 확인
4. 데이터 인터페이스 재설계
5. 구현 계획 구체화

---

## 7. 참고 프로젝트

- **AEDpics**: C:\project\AEDpics\ (지도 UI 참조용, 읽기만 수행)
- 기존 프로젝트는 어떠한 변경도 하지 않음

---

## 8. 의사결정 대기 사항

| 번호 | 항목 | 선택지 | 상태 |
|-----|------|--------|------|
| 1 | 데이터 연동 방식 | Google Sheets API / CSV 내보내기 / 직접 입력 | 미정 |
| 2 | 지도 표시 단위 | 시도별 / 구군별 / 병원별 | 미정 |
| 3 | 지표 표시 방식 | 히트맵 / 숫자 / 아이콘 | 미정 |
| 4 | 요일 선택 UI | 탭 / 드롭다운 / 버튼 그룹 | 미정 |
| 5 | 질환 선택 UI | 드롭다운 / 체크박스 / 검색 | 미정 |
