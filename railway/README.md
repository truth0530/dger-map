# Railway 비상 배포 설정

> **상태**: 비상용 백업 (현재 미사용)
> **마지막 업데이트**: 2025-12-29

## 왜 이 파일들이 있는가?

### 배경
Vercel Serverless 환경에서는 Playwright(브라우저 자동화)를 실행할 수 없습니다.
NEMC(국립응급의료센터) 직접 크롤링이 필요한 경우, Playwright가 동작하는
별도 서버 환경이 필요합니다.

### 용도
- **비상 백업**: 공공데이터포털 API 장애 시 NEMC 직접 크롤링 가능
- **대체 데이터 소스**: API로 제공되지 않는 추가 데이터 수집
- **실시간 크롤링**: 5분 주기 자동 크롤링 + 캐싱

### 현재 상태
- dger-map은 공공데이터포털 API를 주 데이터 소스로 사용 중
- Railway 서버는 **필요시에만** 배포하여 사용
- 평상시에는 이 파일들을 유지만 하고 실행하지 않음

## 파일 목록

| 파일 | 설명 |
|------|------|
| `railway.json` | Railway 배포 설정 |
| `nixpacks.toml` | Chromium 설치 설정 (Playwright용) |
| `Procfile` | 시작 명령어 |
| `railway-server.js` | Express 기반 크롤링 서버 |
| `nemc-playwright-crawl.js` | Playwright 크롤링 로직 |

## 배포 방법 (비상시)

### 1. Railway 프로젝트 생성
1. https://railway.app 접속
2. "New Project" → "Deploy from GitHub repo"
3. 이 저장소의 `railway/` 폴더를 루트로 지정

### 2. 환경 변수 설정
```
NEMC_LOGIN_ID=your_id
NEMC_LOGIN_PW=your_password
PORT=3000
```

### 3. 배포 확인
```bash
curl https://your-app.railway.app/health
curl https://your-app.railway.app/api/nemc-crawl?region=대구
```

## 아키텍처 (비상 모드)

```
┌─────────────────────────────────────────────────────────┐
│                        사용자                             │
└─────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
┌──────────────────────┐      ┌──────────────────────┐
│   Vercel (프론트엔드)  │      │   Railway (크롤링)    │
│  - Next.js App       │      │  - Playwright        │
│  - 정적 페이지         │◄─────│  - NEMC 직접 크롤링   │
│  - API Routes        │ CORS │  - 5분 자동 크롤링    │
└──────────────────────┘      └──────────────────────┘
```

## 비용
- Railway Hobby Plan: 월 $5
- 비상시에만 배포하여 비용 절감

## 주의사항
- NEMC 계정 정보가 필요함
- Playwright는 메모리를 많이 사용 (최소 512MB 권장)
- 크롤링 빈도가 너무 높으면 NEMC에서 차단될 수 있음
