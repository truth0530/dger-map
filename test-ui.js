const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('브라우저 열기...');
  await page.goto('http://localhost:3000/map', { waitUntil: 'networkidle' });

  console.log('\n페이지 로드 완료!');
  console.log('현재 URL:', page.url());

  // 페이지에 있는 버튼들 확인
  const buttons = await page.$$('button');
  console.log('\n찾은 버튼 개수:', buttons.length);

  // 각 버튼의 정보 출력
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    const title = await buttons[i].getAttribute('title');
    console.log(`버튼 ${i}: text="${text}" title="${title}"`);
  }

  console.log('\n5초 대기 중... (직접 확인해주세요)');
  await page.waitForTimeout(5000);

  // 달 모양 아이콘 버튼 찾기 (지도 스타일)
  const styleToggle = await page.$('button[title*="스타일"]');
  if (styleToggle) {
    console.log('\n달 모양 버튼 찾음! 클릭합니다...');
    await styleToggle.click();
    await page.waitForTimeout(2000);
    console.log('스타일 변경 완료');
  }

  // 해 모양 아이콘 버튼 찾기 (테마 토글)
  const themeToggle = await page.$('button[title*="모드"]');
  if (themeToggle) {
    console.log('\n해 모양 버튼 찾음! 클릭합니다...');
    await themeToggle.click();
    await page.waitForTimeout(2000);
    console.log('테마 변경 완료');
  }

  console.log('\n10초 더 대기 중...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('\n브라우저 종료');
})();
