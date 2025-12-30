# dger-map 성능 측정 리포트

## 측정일: 2024-12-30

## 1. 측정 결과 요약

| 페이지 | 점수 | FCP | LCP | TBT | CLS | SI | TTI |
|--------|------|-----|-----|-----|-----|-----|-----|
| `/` (메인) | 🟢 95 | 0.3s | 1.5s | 0ms | 0.009 | 0.3s | 1.5s |
| `/severe` (중증) | 🟢 96 | 0.3s | 1.4s | 0ms | 0.008 | 0.3s | 1.4s |
| `/messages` (메시지) | 🟢 93 | 0.3s | 1.8s | 30ms | 0.008 | - | - |
| `/map` (지도) | 🟡 64 | 0.3s | 1.2s | 920ms | 0.023 | 2.4s | 3.7s |
| `/feedback` (피드백) | 🟢 98 | 0.3s | 1.2s | 0ms | 0.008 | 0.3s | 1.2s |

**평균 점수: 89점**

---

## 2. Core Web Vitals 기준

| 지표 | Good | Needs Improvement | Poor |
|------|------|-------------------|------|
| FCP (First Contentful Paint) | < 1.8s | 1.8s - 3.0s | > 3.0s |
| LCP (Largest Contentful Paint) | < 2.5s | 2.5s - 4.0s | > 4.0s |
| TBT (Total Blocking Time) | < 200ms | 200ms - 600ms | > 600ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1 - 0.25 | > 0.25 |
| TTI (Time to Interactive) | < 3.8s | 3.8s - 7.3s | > 7.3s |

---

## 3. 페이지별 분석

### 3.1 메인 페이지 (`/`) - 95점 🟢
- **우수**: 모든 Core Web Vitals가 Good 기준 충족
- **특징**: TBT 0ms로 메인 스레드 블로킹 없음

### 3.2 중증질환 페이지 (`/severe`) - 96점 🟢
- **우수**: 가장 높은 점수
- **특징**: 최적화된 API 응답(JSON)으로 빠른 데이터 로딩

### 3.3 응급메시지 페이지 (`/messages`) - 93점 🟢
- **양호**: 병원별 메시지 API 호출로 LCP 1.8s
- **개선 가능**: 병원 메시지 일괄 조회 API 구현 시 개선 가능

### 3.4 지도 페이지 (`/map`) - 64점 🟡
- **문제점**: TBT 920ms, TTI 3.7s
- **원인**: MapLibre/Leaflet 라이브러리 로딩 및 초기화
- **개선 방안**:
  - 지도 라이브러리 지연 로딩 최적화
  - WebWorker를 이용한 마커 렌더링
  - 초기 뷰포트 내 마커만 렌더링

### 3.5 피드백 페이지 (`/feedback`) - 98점 🟢
- **우수**: 가장 간단한 페이지로 최고 점수
- **특징**: 정적 콘텐츠 위주

---

## 4. 성능 측정 도구 사용법

### 4.1 npm 스크립트

```bash
# 전체 페이지 측정 (테이블 출력)
npm run perf:lighthouse

# 전체 페이지 측정 (JSON 출력)
node scripts/lighthouse-all.js --json

# 메인 페이지만 빠르게 측정
npm run perf:lighthouse:quick
```

### 4.2 개별 페이지 측정

```bash
# 기본 HTML 리포트 생성
npx lighthouse http://localhost:3000 --preset=desktop --only-categories=performance

# JSON 형식으로 특정 지표만 추출
npx lighthouse http://localhost:3000/severe --preset=desktop --only-categories=performance --output=json --quiet | jq '{
  score: (.categories.performance.score * 100),
  FCP: .audits["first-contentful-paint"].displayValue,
  LCP: .audits["largest-contentful-paint"].displayValue,
  TBT: .audits["total-blocking-time"].displayValue,
  CLS: .audits["cumulative-layout-shift"].displayValue
}'

# 브라우저에서 바로 열기
npx lighthouse http://localhost:3000 --preset=desktop --only-categories=performance --view
```

### 4.3 사전 조건

```bash
# 개발 서버 실행 (필수)
npm run dev

# 포트 3000 사용 확인
lsof -i :3000
```

---

## 5. 최적화 이력

### 2024-12-30: Phase 1 - API 응답 최적화

| 항목 | Before | After | 개선율 |
|------|--------|-------|--------|
| API 응답 형식 | XML | JSON | 파싱 속도 50%↑ |
| 병원유형 매핑 | 217KB | 15KB | 93%↓ |
| Cache-Control | 없음 | s-maxage=120 | CDN 캐시 적용 |

**변경 파일:**
- `src/app/api/bed-info/route.ts` - JSON 응답 변환
- `src/app/api/severe-diseases/route.ts` - JSON 응답 변환
- `src/lib/data/hospitalTypeMap.ts` - 경량 JSON 직접 import
- `src/lib/data/hospitalTypeMapping.json` - 신규 (15KB)

### 2024-12-30: Phase 2 - Leaflet 최적화

| 항목 | Before | After |
|------|--------|-------|
| Leaflet 로딩 | CDN | npm 패키지 번들 |

**변경 파일:**
- `src/components/maplibre/LeafletMap.tsx` - dynamic import 방식 변경

### 2024-12-30: 버그 수정

| 문제 | 원인 | 해결 |
|------|------|------|
| `/messages` 페이지 메시지 미표시 | bed-info API JSON 변환 후 파싱 로직 미갱신 | XML→JSON 파싱으로 수정 |

**변경 파일:**
- `src/app/messages/page.tsx` - fetchHospitalsForRegion 함수 JSON 파싱으로 수정

---

## 6. 향후 개선 계획

### 높은 우선순위
- [ ] `/map` 페이지 TBT 개선 (목표: < 200ms)
  - 지도 라이브러리 코드 스플리팅
  - 마커 가상화 (viewport 기반 렌더링)

### 중간 우선순위
- [ ] `/messages` 페이지 병원 메시지 일괄 조회 API 구현
- [ ] Service Worker 캐싱 전략 추가

### 낮은 우선순위
- [ ] 이미지 최적화 (WebP/AVIF 변환)
- [ ] 폰트 최적화 (font-display: swap)

---

## 7. 참고 자료

- [Lighthouse 문서](https://developer.chrome.com/docs/lighthouse/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Next.js 성능 최적화](https://nextjs.org/docs/app/building-your-application/optimizing)
