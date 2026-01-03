/**
 * Railway 전용 NEMC 크롤링 서버
 * Playwright 기반 크롤링만 제공
 *
 * 비상용 백업 서버:
 * - Vercel Serverless에서 Playwright 실행 불가 시 대체용
 * - NEMC 직접 크롤링이 필요할 때 사용
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정 - Vercel에서 접근 가능하도록
app.use(cors({
  origin: [
    'https://www.dger.kr',
    'https://dger.kr',
    'http://localhost:3000',
    /\.vercel\.app$/  // 모든 Vercel 프리뷰 도메인 허용
  ],
  credentials: true
}));

app.use(express.json());

// 크롤링 API 가져오기
const crawlNEMCWithPlaywright = require('./nemc-playwright-crawl');

// 크롤링 결과 캐시 (5분 TTL)
let cachedData = null;
let lastCrawlTime = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분

// 크롤링 상태
let crawlStatus = {
  inProgress: false,
  lastSuccess: null,
  lastError: null,
  totalCrawls: 0,
  successfulCrawls: 0,
  failedCrawls: 0
};

// 자동 크롤링 인터벌
let autoCrawlInterval = null;

// 지역 코드 매핑
const REGION_CODES = {
  '서울': '11',
  '부산': '26',
  '대구': '13',
  '인천': '28',
  '광주': '29',
  '대전': '30',
  '울산': '31',
  '세종': '36',
  '경기': '41',
  '강원': '42',
  '충북': '43',
  '충남': '44',
  '전북': '45',
  '전남': '46',
  '경북': '47',
  '경남': '48',
  '제주': '50'
};

/**
 * 데이터 정규화 함수
 */
function normalizeHospitalData(rawData) {
  if (!Array.isArray(rawData)) {
    rawData = [rawData];
  }

  return rawData.map(hospital => {
    const normalized = {
      hpid: hospital.hpid || hospital.id,
      name: hospital.name || hospital.hospnm,
      tel: hospital.tel || hospital.dutytel3 || '',

      // 응급실 병상
      hvec: parseInt(hospital.hvec) || 0,
      hvs01: parseInt(hospital.hvs01) || parseInt(hospital.hvoc) || 0,

      // 코호트 격리
      hv27: parseInt(hospital.hv27) || parseInt(hospital.cohortAvailable) || 0,
      HVS59: parseInt(hospital.HVS59) || parseInt(hospital.cohortTotal) || 0,

      // 음압격리
      hv29: parseInt(hospital.hv29) || 0,
      HVS62: parseInt(hospital.HVS62) || 0,

      // 일반격리
      hv30: parseInt(hospital.hv30) || 0,
      HVS63: parseInt(hospital.HVS63) || 0,

      // 소아
      hv9: parseInt(hospital.hv9) || 0,
      HVS02: parseInt(hospital.HVS02) || 0,

      // 화상
      hv13: parseInt(hospital.hv13) || 0,
      hv14: parseInt(hospital.hv14) || 0,

      // 외상
      HVS46: parseInt(hospital.HVS46) || 0,
      HVS47: parseInt(hospital.HVS47) || 0,

      // 정신
      hv15: parseInt(hospital.hv15) || 0,
      HVS48: parseInt(hospital.HVS48) || 0,

      // 신생아
      hv16: parseInt(hospital.hv16) || 0,
      HVS49: parseInt(hospital.HVS49) || 0,

      // 병원 유형
      hpbd: hospital.typeCode || hospital.hpbd || 'G999',

      // 추가 정보
      address: hospital.address || '',
      distance: hospital.distance || null,
      latitude: hospital.latitude || null,
      longitude: hospital.longitude || null,

      // 메타 정보
      hvidate: hospital.bedTrnsDt || new Date().toISOString(),
      crawledAt: hospital.bedTrnsDt || new Date().toISOString(),
      dataTransmitTime: hospital.bedTrnsDt
    };

    return normalized;
  });
}

/**
 * NEMC 크롤링 함수
 */
async function crawlNEMC(region = '대구') {
  console.log(`🎭 [Railway] Playwright 크롤링 시작 - 지역: ${region}`);

  try {
    const jsonData = await crawlNEMCWithPlaywright(region);

    if (!jsonData || jsonData.length === 0) {
      throw new Error('크롤링 데이터가 비어있습니다');
    }

    const normalized = normalizeHospitalData(jsonData);
    console.log(`✅ [Railway] ${normalized.length}개 병원 데이터 크롤링 완료`);

    return normalized;
  } catch (error) {
    console.error('❌ [Railway] 크롤링 실패:', error.message);
    throw error;
  }
}

/**
 * 자동 크롤링 시작
 */
function startAutoCrawl(region = '대구') {
  console.log(`⏰ [Railway] 자동 크롤링 시작 (5분 주기, 지역: ${region})`);

  // 초기 크롤링
  (async () => {
    try {
      crawlStatus.inProgress = true;
      const data = await crawlNEMC(region);
      cachedData = data;
      lastCrawlTime = Date.now();
      crawlStatus.inProgress = false;
      crawlStatus.lastSuccess = new Date().toISOString();
      crawlStatus.successfulCrawls++;
      console.log(`✅ [Railway] 초기 크롤링 완료 - ${data.length}개 병원`);
    } catch (error) {
      crawlStatus.inProgress = false;
      crawlStatus.lastError = error.message;
      crawlStatus.failedCrawls++;
      console.error('❌ [Railway] 초기 크롤링 실패:', error.message);
    }
  })();

  // 5분마다 자동 크롤링
  autoCrawlInterval = setInterval(async () => {
    if (crawlStatus.inProgress) {
      console.log('⏳ [Railway] 이미 크롤링 진행 중, 스킵...');
      return;
    }

    try {
      console.log('⏰ [Railway] 정기 크롤링 시작');
      crawlStatus.inProgress = true;
      const data = await crawlNEMC(region);
      cachedData = data;
      lastCrawlTime = Date.now();
      crawlStatus.inProgress = false;
      crawlStatus.lastSuccess = new Date().toISOString();
      crawlStatus.successfulCrawls++;
      console.log(`✅ [Railway] 정기 크롤링 완료 - ${data.length}개 병원`);
    } catch (error) {
      crawlStatus.inProgress = false;
      crawlStatus.lastError = error.message;
      crawlStatus.failedCrawls++;
      console.error('❌ [Railway] 정기 크롤링 실패:', error.message);
    }
  }, CACHE_TTL);
}

// 서버 시작 시 자동 크롤링 활성화
startAutoCrawl('대구');

/**
 * API 엔드포인트: NEMC 크롤링 데이터
 */
app.get('/api/nemc-crawl', async (req, res) => {
  const { region = '대구', force = false } = req.query;

  crawlStatus.totalCrawls++;

  console.log(`📡 [Railway API] 요청 수신 - region: ${region}, force: ${force}`);

  // 캐시 확인 (force가 아닌 경우)
  if (!force && cachedData && lastCrawlTime) {
    const cacheAge = Date.now() - lastCrawlTime;
    if (cacheAge < CACHE_TTL) {
      console.log(`💾 [Railway] 캐시된 데이터 반환 (${Math.floor(cacheAge / 1000)}초 전 크롤링)`);
      return res.json({
        success: true,
        source: 'cache',
        cacheAge: Math.floor(cacheAge / 1000),
        data: cachedData,
        crawlStatus,
        server: 'Railway'
      });
    }
  }

  // 이미 크롤링 중인 경우
  if (crawlStatus.inProgress) {
    console.log('⏳ [Railway] 이미 크롤링 진행 중...');

    // 캐시된 데이터가 있으면 반환
    if (cachedData) {
      return res.json({
        success: true,
        source: 'cache-while-crawling',
        data: cachedData,
        crawlStatus,
        server: 'Railway'
      });
    }

    return res.status(429).json({
      success: false,
      error: '크롤링이 이미 진행 중입니다. 잠시 후 다시 시도해주세요.',
      crawlStatus,
      server: 'Railway'
    });
  }

  // 새로운 크롤링 실행
  try {
    console.log('🚀 [Railway] 새로운 크롤링 시작');
    crawlStatus.inProgress = true;

    const data = await crawlNEMC(region);

    cachedData = data;
    lastCrawlTime = Date.now();
    crawlStatus.inProgress = false;
    crawlStatus.lastSuccess = new Date().toISOString();
    crawlStatus.successfulCrawls++;

    res.json({
      success: true,
      source: 'fresh',
      data: data,
      crawlStatus,
      server: 'Railway'
    });

  } catch (error) {
    crawlStatus.inProgress = false;
    crawlStatus.lastError = error.message;
    crawlStatus.failedCrawls++;

    console.error('❌ [Railway] 크롤링 실패:', error.message);

    // 캐시된 데이터가 있으면 반환
    if (cachedData) {
      return res.json({
        success: true,
        source: 'cache-after-error',
        data: cachedData,
        crawlStatus,
        server: 'Railway',
        warning: '최신 크롤링 실패, 캐시 데이터 반환'
      });
    }

    res.status(500).json({
      success: false,
      error: '크롤링 실패',
      message: error.message,
      crawlStatus,
      server: 'Railway'
    });
  }
});

/**
 * 헬스 체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'Railway',
    crawlStatus,
    cache: {
      hasData: !!cachedData,
      dataCount: cachedData ? cachedData.length : 0,
      lastCrawl: lastCrawlTime ? new Date(lastCrawlTime).toISOString() : null,
      cacheAge: lastCrawlTime ? Math.floor((Date.now() - lastCrawlTime) / 1000) : null
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * 루트 엔드포인트
 */
app.get('/', (req, res) => {
  res.json({
    name: 'DGER Railway Crawling Server',
    version: '1.0.0',
    description: 'NEMC Playwright 크롤링 전용 서버',
    endpoints: {
      '/api/nemc-crawl': 'NEMC 크롤링 데이터 (GET, ?region=대구&force=false)',
      '/health': '서버 상태 확인'
    },
    server: 'Railway'
  });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Railway] 서버 시작됨 - 포트 ${PORT}`);
  console.log(`📡 [Railway] CORS 허용 도메인: www.dger.kr, dger.kr, *.vercel.app`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ [Railway] SIGTERM 수신, 서버 종료 중...');
  if (autoCrawlInterval) {
    clearInterval(autoCrawlInterval);
  }
  process.exit(0);
});
