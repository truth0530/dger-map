/**
 * Playwright를 사용한 NEMC 병상 데이터 크롤링
 * - 로그인 후 브라우저 컨텍스트에서 직접 API 호출
 *
 * 비상용 백업:
 * - Vercel Serverless에서 Playwright 실행 불가
 * - Railway 또는 VM 환경에서만 사용 가능
 */

const { chromium } = require('playwright');
require('dotenv').config();

async function crawlNEMCWithPlaywright(region = '대구') {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log(`🎭 [Playwright Crawler] ${region} 크롤링 시작...`);

  try {
    // 지역 코드 매핑 (NEMC API 실제 코드 기준)
    const regionCodeMap = {
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

    const coordsMap = {
      '서울': { lat: 37.5669359, lon: 126.9845945 },
      '대구': { lat: 35.8863, lon: 128.6086 },
      '부산': { lat: 35.1796, lon: 129.0756 },
      '인천': { lat: 37.4563, lon: 126.7052 },
      '광주': { lat: 35.1595, lon: 126.8526 },
      '대전': { lat: 36.3504, lon: 127.3845 },
      '울산': { lat: 35.5384, lon: 129.3114 },
      '세종': { lat: 36.4800, lon: 127.2890 },
      '경기': { lat: 37.2636, lon: 127.0286 },
      '강원': { lat: 37.8228, lon: 128.1555 },
      '충북': { lat: 36.6357, lon: 127.4917 },
      '충남': { lat: 36.5184, lon: 126.8000 },
      '전북': { lat: 35.7175, lon: 127.1530 },
      '전남': { lat: 34.8679, lon: 126.9910 },
      '경북': { lat: 36.5760, lon: 128.5056 },
      '경남': { lat: 35.4606, lon: 128.2132 },
      '제주': { lat: 33.4890, lon: 126.4983 }
    };

    const regionCode = regionCodeMap[region] || '27';
    const coords = coordsMap[region] || coordsMap['대구'];

    // 1. 로그인 페이지 접속
    console.log('🔐 [Playwright] 로그인 페이지 접속...');
    await page.goto('https://portal.nemc.or.kr:444/member/login_page.do?redirect=mediboard', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 2. 로그인
    console.log('🔑 [Playwright] 로그인 수행...');
    await page.fill('input[name="useridno"]', process.env.NEMC_LOGIN_ID);
    await page.fill('input[name="userpswd"]', process.env.NEMC_LOGIN_PW);
    await page.click('button[type="submit"], input[type="submit"], .login-button');

    // 3. Mediboard로 리다이렉트 대기
    console.log('🌐 [Playwright] Mediboard 페이지 대기...');
    await page.waitForTimeout(5000);

    // 현재 URL 확인
    const currentUrl = page.url();
    console.log(`📍 [Playwright] 현재 URL: ${currentUrl}`);

    // Mediboard professional 페이지로 이동
    if (!currentUrl.includes('mediboard')) {
      console.log('🔄 [Playwright] Mediboard로 이동...');
      await page.goto('https://mediboard.nemc.or.kr/professional', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
    }

    console.log('✅ [Playwright] 로그인 및 페이지 로드 완료');
    await page.waitForTimeout(3000);

    // 4. 브라우저 컨텍스트에서 직접 API 호출
    console.log(`📡 [Playwright] API 직접 호출 (region: ${region}, code: ${regionCode})...`);

    const apiUrl = `https://mediboard.nemc.or.kr/api/v1/search/detail/professional?asort=A%2CC%2CD&rltmEmerCd=O001%2CO002%2CO060%2CO004%2CO003%2CO049%2CO048%2CO059&searchCondition=regional&emogloca=${regionCode}&lat=${coords.lat}&lon=${coords.lon}`;

    console.log(`🔗 [Playwright] API URL: ${apiUrl.substring(0, 120)}...`);

    // page.evaluate로 브라우저 컨텍스트에서 fetch 실행 (쿠키 자동 포함됨)
    const response = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!res.ok) {
          return {
            error: true,
            status: res.status,
            statusText: res.statusText
          };
        }

        const data = await res.json();
        return {
          error: false,
          data: data
        };
      } catch (e) {
        return {
          error: true,
          message: e.message
        };
      }
    }, apiUrl);

    // 응답 처리
    if (response.error) {
      console.error('❌ [Playwright] API 호출 실패:', response.status || response.message);
      throw new Error(`API 호출 실패: ${response.status || response.message}`);
    }

    console.log(`✅ [Playwright] API 응답 수신`);

    // 데이터 추출
    if (response.data && response.data.result && response.data.result.data) {
      const hospitalData = response.data.result.data;
      console.log(`✅ [Playwright] ${hospitalData.length}개 병원 데이터 획득`);
      console.log(`📊 [Playwright] 첫 번째 병원: ${hospitalData[0]?.name || '없음'}`);

      await browser.close();
      return hospitalData;
    } else {
      console.warn('⚠️ [Playwright] 예상과 다른 응답 구조');
      console.warn('응답 샘플:', JSON.stringify(response.data).substring(0, 300));
      throw new Error('응답 데이터 구조가 예상과 다름');
    }

  } catch (error) {
    console.error('❌ [Playwright] 크롤링 실패:', error.message);

    // 디버깅용 스크린샷
    try {
      await page.screenshot({ path: 'nemc-error-final.png' });
      console.log('📸 [Playwright] 에러 스크린샷: nemc-error-final.png');
    } catch (e) {
      // 스크린샷 실패 무시
    }

    await browser.close();
    throw error;
  }
}

module.exports = crawlNEMCWithPlaywright;
