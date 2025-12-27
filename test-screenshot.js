const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 화면 해상도 설정
  await page.setViewportSize({ width: 1280, height: 720 });

  console.log('페이지 로드 중...');
  await page.goto('http://localhost:3000/map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('1. 초기 상태 스크린샷 저장...');
  await page.screenshot({ path: 'c:\\project\\DGEMS-map\\screenshot-1-initial.png' });

  // 해 모양 버튼 찾기
  const themeBtn = await page.$('button[title*="모드"]');
  if (themeBtn) {
    console.log('2. 해 모양 버튼 클릭...');
    await themeBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'c:\\project\\DGEMS-map\\screenshot-2-theme-changed.png' });
  }

  // 달 모양 버튼 찾기
  const styleBtn = await page.$('button[title*="스타일"]');
  if (styleBtn) {
    console.log('3. 달 모양 버튼 클릭...');
    await styleBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'c:\\project\\DGEMS-map\\screenshot-3-style-changed.png' });
  }

  // 줌 인 버튼
  const zoomIn = await page.$('button[title="확대"]');
  if (zoomIn) {
    console.log('4. 줌 인 버튼 클릭...');
    await zoomIn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'c:\\project\\DGEMS-map\\screenshot-4-zoom-in.png' });
  }

  // 전체화면 버튼
  const fullscreen = await page.$('button[title="전체화면"]');
  if (fullscreen) {
    console.log('5. 전체화면 버튼 클릭...');
    await fullscreen.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'c:\\project\\DGEMS-map\\screenshot-5-fullscreen.png' });
  }

  console.log('스크린샷 저장 완료!');
  console.log('저장된 파일:');
  console.log('- screenshot-1-initial.png (초기 상태)');
  console.log('- screenshot-2-theme-changed.png (테마 변경 후)');
  console.log('- screenshot-3-style-changed.png (스타일 변경 후)');
  console.log('- screenshot-4-zoom-in.png (줌 인 후)');
  console.log('- screenshot-5-fullscreen.png (전체화면 클릭 후)');

  await browser.close();
})();
