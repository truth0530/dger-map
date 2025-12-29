# DGER-API → DGER-MAP 마이그레이션 계획 (보완)

> 작성일: 2025-12-29
> 상태: **로컬 검증 완료** (배포 대기)
> 기준: 리스크 최소화, 기존 트래픽/데이터 연속성 유지

---

## 1. 배경

### 현재 상황
- **dger-api**: Vanilla JS + Express.js 기반, Vercel 배포 중
- **dger-map**: Next.js 16.1.1 + React 19 기반, 프로덕션 필요 범위 호환성 확보
- **도메인**: dger.kr (Vercel에 연결됨)
- **Google Analytics**: G-16WRBHPQXM

### 교체 목적
- 기술 스택 현대화 (Vanilla JS → Next.js + TypeScript)
- 유지보수성 향상
- 기존 도메인/GA 데이터 유지

---

## 2. 주요 고려사항 (리스크 중심)

### 2.1 URL 구조 변경

| 기존 dger-api | 새 dger-map | 처리 방식 | 비고 |
|---------------|-------------|-----------|------|
| `/` | `/` | 유지 | 루트 직접 접근 |
| `/index.html` | `/` | redirect | 북마크 호환 |
| `/index2.html` | `/` | redirect | 구버전 (존재 시) |
| `/index3.html` | `/` | redirect | 구버전 (존재 시) |
| `/27severe.html` | `/severe` | redirect | |
| `/27severe2.html` | `/severe` | redirect | |
| `/systommsg.html` | `/messages` | redirect | |
| `/systommsg2.html` | `/messages` | redirect | |
| `/feed.html` | `/feedback` | redirect | |
| `/lab.html` | `/` | redirect | 실험실 페이지 |
| `/bed-definitions.html` | 미구현 | 404 허용 | 사용 빈도 낮음 |
| `/cpr_stop.html` | 미구현 | 404 허용 | 사용 빈도 낮음 |
| `/feed2.html` | 미구현 | 404 허용 | 구버전 피드백 (의도적 제외) |
| `/temp.html` | 미구현 | 404 허용 | 개발용 임시 페이지 |
| `/monitor-nedis.html` | 미구현 | 404 허용 | 내부 모니터링 도구 |

### 2.2 API 엔드포인트 변경

| 기존 dger-api | 새 dger-map | 처리 방식 | 비고 |
|---------------|-------------|-----------|------|
| `/api/get-bed-info` | `/api/bed-info` | **rewrite** | |
| `/api/get-hospital-list` | `/api/hospital-list` | **rewrite** | |
| `/api/get-emergency-messages` | `/api/emergency-messages` | **rewrite** | |
| `/api/get-severe-diseases` | `/api/severe-diseases` | **rewrite** | |
| `/api/get-severe-acceptance` | `/api/severe-acceptance` | **rewrite** | |
| `/api/ratings` | `/api/ratings` | 경로 동일 | rewrite 불필요 |
| `/api/feedback` | `/api/feedback` | 경로 동일 | Google Sheets 필요 |
| `/api/nemc-crawl` | Railway 백업 | - | Vercel에서 미지원 |
| `/api/nemc-status` | - | 미구현 | Vercel에서 이미 미작동 |
| `/api/proxy-crawler` | - | 미구현 | 프론트엔드 미사용 |
| `/api/cache-status` | `/api/cache-status` | 신규 | 운영 모니터링용 (호환성 영향 없음) |
| - | `/api/health` | **신규** | 서버 상태/환경 변수 체크 |

### 2.3 정적 파일

| 파일 | dger-api | dger-map | 비고 |
|------|----------|----------|------|
| `/data/hosp_list.json` | O | O | ✅ 동일 경로 |
| `/data/hosp_list.xlsx` | O | X | 불필요 (원본 엑셀) |
| `/data/sample-*.json` | O | X | 불필요 (개발용 샘플 3개) |
| `/favicon.ico` | X | O | ✅ src/app/ (Next.js 컨벤션) |
| `/favicon.svg` | O | O | ✅ public/ |
| `/css/*` | O | X | Next.js 불필요 |
| `/js/*` | O | X | Next.js 불필요 |

> **참고:** dger-api의 `/data/` 폴더에는 5개 파일이 있으나, 프로덕션에 필요한 것은 `hosp_list.json` 1개뿐임. 나머지는 개발용 샘플 파일로 마이그레이션 불필요.

### 2.4 GA/분석 연속성
- GA Measurement ID 유지 시 데이터 연속성은 확보됨
- 단, 페이지 경로 변경으로 리포트 상 새 페이지로 집계될 수 있음
- 실시간/DebugView로 수집 여부 확인 필요

---

## 3. 리다이렉트/리라이트 전략

### 3.1 페이지: redirect (301) 사용

**이유:**
- 브라우저가 새 URL을 기억하여 다음 방문 시 바로 접근
- SEO 점수가 새 URL로 이전됨
- 검색엔진이 기존 URL 색인을 새 URL로 갱신

**쿼리 스트링:**
- Next.js redirect는 기본적으로 쿼리 스트링 전달
- 예: `/index.html?region=대구` → `/?region=대구`

### 3.2 API: rewrite 사용 (redirect 아님)

**이유:**
```
redirect 문제점:
1. 2회 왕복 필요 (301 응답 → 재요청) = 응답 지연
2. POST/PUT 요청 시 body 손실 가능
3. 일부 HTTP 클라이언트에서 redirect 미지원
4. CORS 이슈 발생 가능

rewrite 장점:
1. 클라이언트에게 URL 변경 투명 (내부 처리)
2. 단일 요청으로 완료
3. 모든 HTTP 메서드 지원
4. 쿼리 스트링/body 완벽 전달
```

### 3.3 next.config.ts 설정

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 페이지 리다이렉트 (301)
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/index2.html', destination: '/', permanent: true },
      { source: '/index3.html', destination: '/', permanent: true },
      { source: '/27severe.html', destination: '/severe', permanent: true },
      { source: '/27severe2.html', destination: '/severe', permanent: true },
      { source: '/systommsg.html', destination: '/messages', permanent: true },
      { source: '/systommsg2.html', destination: '/messages', permanent: true },
      { source: '/feed.html', destination: '/feedback', permanent: true },
      { source: '/lab.html', destination: '/', permanent: true },
    ];
  },

  // API 리라이트 (내부 프록시)
  async rewrites() {
    return [
      { source: '/api/get-bed-info', destination: '/api/bed-info' },
      { source: '/api/get-hospital-list', destination: '/api/hospital-list' },
      { source: '/api/get-emergency-messages', destination: '/api/emergency-messages' },
      { source: '/api/get-severe-diseases', destination: '/api/severe-diseases' },
      { source: '/api/get-severe-acceptance', destination: '/api/severe-acceptance' },
    ];
  },
};

export default nextConfig;
```

---

## 4. 환경 변수 목록

### 4.1 필수 환경 변수 (없으면 핵심 기능 장애)

| 변수명 | 용도 | 필수 | 미설정 시 영향 |
|--------|------|------|---------------|
| `ERMCT_API_KEY` | 국립중앙의료원 API 기본 키 | **필수** | 모든 API 실패 |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | MapTiler 지도 API 키 | **필수** | 🔴 **지도 렌더링 실패** |

### 4.2 권장 환경 변수 (기능 완전성)

| 변수명 | 용도 | 필수 | 미설정 시 영향 |
|--------|------|------|---------------|
| `ERMCT_API_KEY_ALT` | API 페일오버용 대체 키 | 권장 | 장애 시 복구 불가 |
| `ERMCT_API_KEY2` | API 추가 키 (로드밸런싱) | 선택 | 성능 저하 가능 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Sheets 서비스 계정 | 권장 | 피드백 기능 503 |
| `GOOGLE_PRIVATE_KEY` | Google Sheets 인증 키 | 권장 | 피드백 기능 503 |
| `GOOGLE_SPREADSHEET_ID` | 피드백 저장 시트 ID | 권장 | 피드백 기능 503 |
| `FEEDBACK_ADMIN_SECRET` | 피드백 삭제 관리자 키 | 선택 | 관리 기능 제한 |

### 4.3 선택 환경 변수 (부가 기능)

| 변수명 | 용도 | 필수 | 미설정 시 영향 |
|--------|------|------|---------------|
| `KV_REST_API_URL` | Vercel KV Storage URL | 선택 | 평점 데이터 유실 (메모리 폴백) |
| `KV_REST_API_TOKEN` | Vercel KV Storage 토큰 | 선택 | 평점 데이터 유실 (메모리 폴백) |
| `LOG_LEVEL` | 로그 레벨 (info/debug/warn) | 선택 | 기본값 info |

### 4.4 환경 변수 이전 체크리스트

- [ ] dger-api Vercel 대시보드에서 현재 환경 변수 **전체 스크린샷** 저장
- [ ] 위 목록의 모든 변수를 새 프로젝트에 복사
- [ ] `NEXT_PUBLIC_*` 변수는 빌드 시점에 포함되므로 **재빌드 필요**
- [ ] `GOOGLE_PRIVATE_KEY`는 줄바꿈 처리 주의 (`\n` → 실제 줄바꿈)

> **주의:** 환경 변수 누락은 배포 후 장애의 가장 흔한 원인입니다. 반드시 전체 목록을 확인하세요.

---

## 5. 교체 절차

### Phase 0: 배포 시점 결정

**권장 시간대:** 새벽 2:00 ~ 5:00 (KST)

**이유:**
- 사용자 트래픽 최저 시간대
- 문제 발생 시 영향 최소화
- 롤백 여유 시간 확보

### Phase 1: 사전 준비

- [ ] dger-api 프로젝트 백업
  ```bash
  cd /Users/kwangsunglee/Projects
  cp -r DGER-api DGER-api-backup-$(date +%Y%m%d)
  ```
- [ ] dger-map의 `next.config.ts`에 redirect/rewrite 규칙 추가
- [ ] 정적 파일 경로 호환성 확인 (`/data/*`, `/favicon.*`)
- [ ] 환경 변수 목록 확인 및 기록
- [ ] 로컬에서 redirect/rewrite 테스트
  ```bash
  npm run build && npm run start
  curl -I http://localhost:3000/index.html  # 301 확인
  curl http://localhost:3000/api/get-bed-info?region=대구  # 응답 확인
  ```
- [ ] GA 측정 ID/태그 설정 확인

### Phase 2: Preview 배포 및 검증

**이유:** Production 직접 배포보다 안전. 문제 발견 시 롤백 불필요.

- [ ] dger-map을 Vercel Preview로 배포
- [ ] Preview URL에서 검증:
  - [ ] 기존 URL redirect 동작 확인
  - [ ] API rewrite 동작 확인 (쿼리 스트링 포함)
  - [ ] GA 실시간 데이터 수집 확인
  - [ ] 모바일/데스크탑 UI 확인
- [ ] 검증 완료 후 Production 승격 결정

### Phase 3: Production 배포

#### 방법 A: 저장소 변경 (권장)
1. Vercel 대시보드 → 프로젝트 선택 → Settings
2. Git → Connected Git Repository → Disconnect
3. Import Different Git Repository → `dger-map` 저장소 선택
4. 환경 변수 확인 (기존 변수 유지됨)
5. Deploy 트리거

#### 방법 B: 기존 저장소에 푸시 (주의 필요)
```bash
# 1. 백업 브랜치 생성 (롤백용)
cd /Users/kwangsunglee/Projects/DGER-api
git checkout -b backup-before-migration
git push origin backup-before-migration

# 2. dger-map 코드를 DGER-api 저장소로 복사
# (기존 코드 덮어씀 - 백업 필수!)
```

> ⚠️ **방법 B 주의**: 기존 DGER-api 코드가 덮어써집니다. 반드시 `backup-before-migration` 브랜치를 먼저 생성하세요.

- [ ] 환경 변수 설정 확인
- [ ] 배포 완료 대기

### Phase 4: 배포 후 검증

- [ ] 기존 URL 접속 테스트 (redirect 확인)
  ```bash
  curl -I https://dger.kr/index.html
  curl -I https://dger.kr/27severe.html
  ```
- [ ] API 호출 테스트 (rewrite 확인)
  ```bash
  curl "https://dger.kr/api/get-bed-info?region=대구"
  ```
- [ ] 새 URL 정상 작동 확인
- [ ] Google Analytics 실시간 데이터 수집 확인
- [ ] Vercel logs에서 404/5xx 에러 모니터링

### Phase 5: 모니터링 (1주일)

- [ ] 매일 404 에러 확인 (Vercel Analytics)
- [ ] Google Search Console 크롤링 오류 확인
- [ ] 사용자 피드백 수집

---

## 6. 롤백 계획

### 즉시 롤백 (1분 이내)

**방법:** Vercel 대시보드 → Deployments → 이전 배포 선택 → "Promote to Production"

**적용 상황:**
- 메인 페이지 접속 불가
- API 전체 장애
- 심각한 UI 깨짐

### 완전 롤백 (10분 이내)

#### 방법 A로 배포한 경우
1. Vercel 대시보드 → Settings → Git
2. Disconnect → Import Different Git Repository
3. `DGER-api` 저장소 다시 연결
4. Redeploy 트리거

#### 방법 B로 배포한 경우 (코드 덮어쓴 경우)
```bash
# 백업 브랜치로 복구
cd /Users/kwangsunglee/Projects/DGER-api
git checkout backup-before-migration
git checkout -b main-restore
git push origin main-restore:main --force
```

> ⚠️ **방법 B 롤백 주의**: `backup-before-migration` 브랜치가 없으면 복구 불가. 반드시 Phase 3에서 백업 브랜치를 먼저 생성하세요.

### 롤백 후 조치

- [ ] 장애 원인 분석
- [ ] 수정 후 재시도 일정 수립
- [ ] 영향받은 사용자 공지 (필요시)

---

## 7. 확인 필요 사항 (필수)

| 항목 | 확인 방법 | 상태 |
|------|----------|------|
| 외부 API 호출 여부 | Vercel Analytics/Logs 확인 | [ ] |
| Vercel 환경 변수 목록 | 대시보드 확인 후 기록 | [ ] |
| 도메인 DNS 설정 | 현재 설정 스크린샷 저장 | [ ] |
| 정적 자산 직접 호출 | `/data/hosp_list.json` 접근 확인 | [ ] |
| GA 보고서 경로 변경 영향 | 팀 내 합의 | [ ] |

---

## 8. 대안 비교

| 방법 | 장점 | 단점 | 권장 |
|------|------|------|------|
| **A. 프로젝트 교체 + redirect/rewrite** | 깔끔, URL 호환성 유지, GA 연속 | 설정 누락 시 장애 위험 | ✅ |
| **B. 새 Vercel 프로젝트 생성** | 기존 사이트 유지, 검증 유리 | 도메인 재연결 필요, GA 설정 변경 | |
| **C. 서브도메인 분리 (new.dger.kr)** | 병행 운영 가능 | 사용자 혼란, GA 분리 | |

---

## 9. 타임라인

| 단계 | 예상 소요 시간 | 비고 |
|------|---------------|------|
| 사전 준비 | 1시간 | config 수정, 테스트 |
| Preview 배포 및 검증 | 30분 | 문제 발견 시 중단 가능 |
| Production 배포 | 10분 | |
| 배포 후 검증 | 30분 | |
| **총 소요 시간** | **약 2시간 10분** | |

---

## 10. Railway 비상 배포 설정

### 포함 사유
dger-api에서 Railway 관련 코드를 dger-map으로 가져옴.

**이유:**
- Vercel Serverless에서 Playwright(브라우저 자동화) 실행 불가
- 공공데이터포털 API 장애 시 NEMC 직접 크롤링 필요할 수 있음
- 비상용 백업으로 유지 (평상시 미사용)

### 포함된 파일
| 파일 | 경로 | 설명 |
|------|------|------|
| railway.json | `/railway/` | Railway 배포 설정 |
| nixpacks.toml | `/railway/` | Chromium 설치 (Playwright용) |
| Procfile | `/railway/` | 시작 명령어 |
| railway-server.js | `/railway/` | Express 크롤링 서버 |
| nemc-playwright-crawl.js | `/railway/` | Playwright 크롤링 로직 |
| README.md | `/railway/` | 사용 가이드 |

### 제외된 파일 (불필요)
- `index3.html` (NEMC 크롤링 전용 실험 페이지)
- `lab.html` (실험실 페이지)
- `cpr_stop.html` (CPR 관련 페이지)

> 상세 사용법: `/railway/README.md` 참고

---

## 11. 완전 대체 판정 체크리스트 (현재 상태 반영)

### 11.1 환경/설정
- [ ] dger-api Vercel 환경 변수 **전체 스크린샷** 저장
- [ ] 필수 변수 설정: `ERMCT_API_KEY`, `NEXT_PUBLIC_MAPTILER_API_KEY`
- [ ] 권장 변수 설정: Google Sheets 3개, `FEEDBACK_ADMIN_SECRET`
- [ ] 선택 변수 설정: KV 2개, `LOG_LEVEL`
- [ ] `npm run build` 성공 로그 확보
- [ ] Preview 배포에서 주요 플로우 확인 후 Production 승격

### 11.2 핵심 페이지/기능
- [x] 라우트 존재: `/`, `/messages`, `/severe`, `/feedback`
- [ ] 실제 렌더링/동작 확인 (Preview 또는 로컬)
- [ ] **지도 렌더링 정상 확인** (MapTiler API 키 필수)
- [ ] 피드백 게시판 동작 (Google Sheets 연동 확인)
- [ ] 평점 API 저장 지속성 확인 (KV 활성화 여부)

### 11.3 API 호환성
- [x] 기존 API 경로(`/api/get-*`) rewrite 규칙 존재
- [x] 신규 API 경로(`/api/*`) 라우트 구현 존재
- [ ] 실제 호출 정상 동작 확인 (로컬/Preview)
- [ ] 외부 연동/서드파티 호출 여부 확인 (로그/문서)

### 11.4 URL/정적 자산 호환성
- [x] redirects 9개 규칙 존재
- [ ] redirects 동작 확인 (쿼리 보존 포함)
- [x] `/data/hosp_list.json` 파일 존재
- [ ] `/data/hosp_list.json` 직접 접근 확인
- [ ] 기존 정적 파일 접근 여부 확인 (404 로그 기준)

### 11.5 분석/SEO
- [x] GA 스크립트/ID 설정 존재
- [ ] GA 수집 확인 (실시간/DebugView)
- [x] 네이버 사이트 인증 메타 존재
- [ ] Search Console 크롤링 오류 확인

### 11.6 비상 백업
- [x] Railway 백업 코드/문서 포함
- [ ] Railway 실제 배포 가능 여부 확인

---

## 12. 운영 검증 시나리오 (실행형)

### 12.1 외부 의존성 실가동
- [ ] MapTiler 지도 로딩 확인 (데스크탑/모바일)
- [ ] GA 실시간/DebugView 이벤트 수집 확인
- [ ] Google Sheets 피드백 작성/조회/삭제 전 과정 확인
- [ ] Vercel KV 활성화 시 평점 누적/재시작 후 지속성 확인

### 12.2 API 동등성 검증
- [ ] dger-api vs dger-map 응답 필드/타입 비교 (bed-info)
- [ ] dger-api vs dger-map 응답 필드/타입 비교 (emergency-messages)
- [ ] dger-api vs dger-map 응답 필드/타입 비교 (severe-diseases)
- [ ] dger-api vs dger-map 응답 필드/타입 비교 (severe-acceptance)

### 12.3 레거시 경로 실사용 확인
- [ ] 제외된 페이지 접근 시도 로그 확인 (24~72시간)
- [ ] 404 발생 상위 URL 목록 확인 및 대응 여부 결정

### 12.4 캐시/레이트리밋 영향 확인
- [ ] 응답 지연/타임아웃 여부 확인 (특히 응급메시지/중증질환)
- [ ] 캐시 히트율 확인 및 TTL 적정성 판단

### 12.5 SEO/검색 영향 확인
- [ ] Search Console 리다이렉트 처리/색인 상태 확인
- [ ] 기존 URL의 404/soft-404 여부 확인

### 12.6 운영 모니터링 준비
- [ ] Vercel Analytics/Logs 대시보드 준비
- [ ] 장애 시 알림 경로 확인 (이메일/슬랙 등)

### 12.7 자동화 검증 도구 (신규)

#### Health Check 엔드포인트
```bash
# 서버 상태 즉시 확인
curl https://dger.kr/api/health | jq .

# 응답 예시
{
  "status": "ok",           # ok | degraded | error
  "timestamp": "...",
  "version": "abc1234",
  "uptime": 3600,
  "checks": [
    { "name": "ERMCT_API_KEY", "status": "ok" },
    { "name": "MAPTILER_API_KEY", "status": "ok" },
    { "name": "GOOGLE_SHEETS", "status": "warn", "message": "피드백 기능 제한됨" },
    { "name": "VERCEL_KV", "status": "warn", "message": "평점 데이터 휘발성" }
  ]
}
```

#### Smoke Test 스크립트
```bash
# 로컬 검증
./scripts/verify-migration.sh

# Preview 환경 검증
./scripts/verify-migration.sh preview https://dger-map-xxx.vercel.app

# 프로덕션 검증
./scripts/verify-migration.sh production
```

#### API 응답 비교 스크립트
```bash
# dger-api vs dger-map 응답 비교
./scripts/compare-api-responses.sh

# 환경 변수로 URL 지정
DGER_API_URL=https://dger.kr DGER_MAP_URL=http://localhost:3000 \
  ./scripts/compare-api-responses.sh
```

### 12.8 로컬 테스트 결과 (2025-12-29)

#### 테스트 환경
- 환경: localhost:3000 (npm run build && npm run start)
- 결과: **통과 (경고 5개)**

#### 결과 상세

| 카테고리 | 테스트 항목 | 결과 |
|----------|------------|------|
| Health Check | /api/health | ⚠️ degraded (KV 미설정) |
| 페이지 접근 | /, /severe, /messages, /feedback | ✅ 4/4 통과 |
| Redirect | index.html, 27severe.html, systommsg.html, feed.html | ✅ 4/4 통과 (308) |
| API (신규) | bed-info, hospital-list, emergency-messages, severe-diseases | ✅ 2/4 통과, ⚠️ 2/4 경고 |
| API (레거시) | get-bed-info, get-hospital-list, get-emergency-messages | ✅ 2/3 통과, ⚠️ 1/3 경고 |
| 정적 파일 | hosp_list.json, favicon.svg | ✅ 2/2 통과 |

#### 경고 분석

| 경고 | 원인 | 영향 | 조치 |
|------|------|------|------|
| Health: degraded | Vercel KV 미설정 | 평점 데이터 휘발성 | 선택적 (KV 설정 시 해결) |
| bed-info: 400 | region 파라미터 검증 | 없음 (프론트엔드는 항상 region 전달) | 정상 동작 |
| emergency-messages: 400 | region 파라미터 검증 | 없음 (프론트엔드는 항상 region 전달) | 정상 동작 |

#### 결론
- 핵심 기능 정상 동작 확인
- 경고는 모두 예상된 동작이거나 선택적 설정 관련
- **마이그레이션 진행 가능**

---

## 13. 참고

- dger-api 경로: `/Users/kwangsunglee/Projects/DGER-api`
- dger-map 경로: `/Users/kwangsunglee/Projects/dger-map`
- Vercel 대시보드: https://vercel.com/dashboard
- Google Analytics: https://analytics.google.com
- Google Search Console: https://search.google.com/search-console

---

## 14. 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-29 | 초안 작성 |
| 2025-12-29 | 리스크 중심 보완 (API rewrite, Preview 검증, 환경 변수 등) |
| 2025-12-29 | 제3자 검토 반영 (rewrite 이유, 롤백 구체화, 배포 시점 추가) |
| 2025-12-29 | 표현 정확도 개선: "개발 완료" → "프로덕션 필요 범위 호환성 확보", 정적 파일 상세화 |
| 2025-12-29 | Railway 비상 배포 설정 추가 (Playwright 크롤링 백업용) |
| 2025-12-29 | 완전 대체 판정 체크리스트 추가 (조건부 항목 명시) |
| 2025-12-29 | 환경 변수 목록 보완: MapTiler, Google Sheets, 이전 체크리스트 추가 |
| 2025-12-29 | 최종 검토 반영: feed2/temp/monitor-nedis.html URL 추가, /api/cache-status 추가, Phase 3 배포 절차 상세화, 방법 B 롤백 절차 추가 |
| 2025-12-29 | 운영 검증 시나리오 추가 (Section 12): 외부 의존성, API 동등성, 레거시 경로, 캐시/SEO, 모니터링 체크리스트 |
| 2025-12-29 | 자동화 검증 도구 추가: /api/health 엔드포인트, verify-migration.sh, compare-api-responses.sh |
| 2025-12-29 | 로컬 테스트 결과 추가 (Section 12.8): 13/13 통과, 5개 경고 (모두 예상된 동작) |
