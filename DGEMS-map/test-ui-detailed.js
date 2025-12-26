const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const context = browser.contexts()[0];

  console.log('=== 브라우저 열기 ===');
  await page.goto('http://localhost:3000/map', { waitUntil: 'networkidle' });
  console.log('페이지 로드 완료!');

  // 페이지 상태 확인
  console.log('\n=== 초기 상태 확인 ===');
  const bodyClass = await page.getAttribute('body', 'class');
  const htmlClass = await page.getAttribute('html', 'class');
  console.log('Body class:', bodyClass);
  console.log('HTML class:', htmlClass);

  // 범례 확인
  console.log('\n=== 범례 확인 ===');
  const legendVisible = await page.isVisible('div:has-text("기관분류 범례")');
  console.log('범례 표시됨:', legendVisible);

  // 30초 대기 - 직접 화면 확인
  console.log('\n30초 대기 중... 현재 상태를 확인하세요');
  await page.waitForTimeout(30000);

  // 해 모양 버튼 클릭 (테마 토글)
  console.log('\n=== 해 모양 버튼 클릭 ===');
  const themeButtons = await page.$$('button[title*="모드"]');
  console.log('찾은 테마 버튼 개수:', themeButtons.length);

  if (themeButtons.length > 0) {
    console.log('첫 번째 테마 버튼 클릭...');
    await themeButtons[0].click();
    await page.waitForTimeout(2000);

    const htmlClassAfter = await page.getAttribute('html', 'class');
    console.log('클릭 후 HTML class:', htmlClassAfter);
    console.log('테마 변경됨!');
  }

  console.log('\n30초 대기... 테마 변경을 확인하세요');
  await page.waitForTimeout(30000);

  // 달 모양 버튼 클릭 (지도 스타일)
  console.log('\n=== 달 모양 버튼 클릭 ===');
  const styleButtons = await page.$$('button[title*="스타일"]');
  console.log('찾은 스타일 버튼 개수:', styleButtons.length);

  if (styleButtons.length > 0) {
    console.log('스타일 버튼 클릭...');
    await styleButtons[0].click();
    await page.waitForTimeout(3000);
    console.log('지도 스타일 변경됨!');
  }

  console.log('\n30초 대기... 지도 스타일 변경을 확인하세요');
  await page.waitForTimeout(30000);

  // 줌 인 버튼 클릭
  console.log('\n=== 줌 인 버튼 (+) 클릭 ===');
  const zoomInBtn = await page.$('button[title="확대"]');
  if (zoomInBtn) {
    console.log('줌 인 버튼 클릭...');
    await zoomInBtn.click();
    await page.waitForTimeout(1000);
    console.log('줌 인 완료!');
  }

  console.log('\n30초 대기... 줌 변경을 확인하세요');
  await page.waitForTimeout(30000);

  // 줌 아웃 버튼 클릭
  console.log('\n=== 줌 아웃 버튼 (-) 클릭 ===');
  const zoomOutBtn = await page.$('button[title="축소"]');
  if (zoomOutBtn) {
    console.log('줌 아웃 버튼 클릭...');
    await zoomOutBtn.click();
    await page.waitForTimeout(1000);
    console.log('줌 아웃 완료!');
  }

  console.log('\n30초 대기... 줌 변경을 확인하세요');
  await page.waitForTimeout(30000);

  // 전체화면 버튼 클릭
  console.log('\n=== 전체화면 버튼 (⛶) 클릭 ===');
  const fullscreenBtn = await page.$('button[title="전체화면"]');
  if (fullscreenBtn) {
    console.log('전체화면 버튼 클릭...');
    try {
      await fullscreenBtn.click();
      await page.waitForTimeout(2000);
      console.log('전체화면 모드 활성화됨!');
    } catch (e) {
      console.log('전체화면 활성화 오류:', e.message);
    }
  }

  console.log('\n30초 대기... 전체화면 모드를 확인하세요');
  await page.waitForTimeout(30000);

  console.log('\n=== 테스트 완료 ===');
  console.log('브라우저를 닫기 전 잠깐만 대기합니다...');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('브라우저 종료');
})();
