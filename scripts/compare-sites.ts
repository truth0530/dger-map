/**
 * Playwright 사이트 비교 스크립트
 * DGEMS-map (Vercel) vs dger-api (dger.kr) 비교
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SITES = {
  dgems: {
    name: 'DGEMS-map (New)',
    baseUrl: 'https://dger-map.vercel.app',
    pages: [
      { path: '/', name: 'home' },
      { path: '/bed', name: 'bed' },
      { path: '/severe', name: 'severe' },
      { path: '/messages', name: 'messages' },
      { path: '/feedback', name: 'feedback' },
    ],
  },
  dgerApi: {
    name: 'dger-api (Original)',
    baseUrl: 'https://dger.kr',
    pages: [
      { path: '/', name: 'home' },
      { path: '/27severe.html', name: 'severe' },
      { path: '/systommsg.html', name: 'messages' },
      { path: '/feed.html', name: 'feedback' },
    ],
  },
};

const OUTPUT_DIR = path.join(__dirname, '../screenshots');

interface PageInfo {
  url: string;
  title: string;
  loadTime: number;
  elementCounts: {
    buttons: number;
    links: number;
    tables: number;
    inputs: number;
    images: number;
  };
  errors: string[];
  networkRequests: number;
  apiCalls: string[];
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function analyzePage(page: Page, url: string): Promise<PageInfo> {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  let networkRequests = 0;

  // 에러 수집
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 네트워크 요청 추적
  page.on('request', (req) => {
    networkRequests++;
    if (req.url().includes('/api/')) {
      apiCalls.push(req.url());
    }
  });

  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const loadTime = Date.now() - startTime;

  // 요소 카운트
  const elementCounts = await page.evaluate(() => ({
    buttons: document.querySelectorAll('button').length,
    links: document.querySelectorAll('a').length,
    tables: document.querySelectorAll('table').length,
    inputs: document.querySelectorAll('input, select').length,
    images: document.querySelectorAll('img').length,
  }));

  const title = await page.title();

  return {
    url,
    title,
    loadTime,
    elementCounts,
    errors,
    networkRequests,
    apiCalls,
  };
}

async function captureScreenshots(browser: Browser, site: typeof SITES.dgems, siteKey: string) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  const results: Record<string, PageInfo> = {};

  console.log(`\n📸 ${site.name} 스크린샷 캡처 중...`);

  for (const pageConfig of site.pages) {
    const url = `${site.baseUrl}${pageConfig.path}`;
    console.log(`  - ${pageConfig.name}: ${url}`);

    try {
      const info = await analyzePage(page, url);
      results[pageConfig.name] = info;

      // 스크린샷 저장
      const screenshotPath = path.join(OUTPUT_DIR, `${siteKey}-${pageConfig.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      console.log(`    ✓ 로드 시간: ${info.loadTime}ms, 요소: ${JSON.stringify(info.elementCounts)}`);
      if (info.errors.length > 0) {
        console.log(`    ⚠ 에러: ${info.errors.length}개`);
      }
    } catch (error) {
      console.error(`    ✗ 실패: ${error}`);
      results[pageConfig.name] = {
        url,
        title: 'Error',
        loadTime: -1,
        elementCounts: { buttons: 0, links: 0, tables: 0, inputs: 0, images: 0 },
        errors: [String(error)],
        networkRequests: 0,
        apiCalls: [],
      };
    }
  }

  await context.close();
  return results;
}

async function generateReport(dgemsResults: Record<string, PageInfo>, dgerApiResults: Record<string, PageInfo>) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      dgems: {
        totalPages: Object.keys(dgemsResults).length,
        avgLoadTime: Math.round(
          Object.values(dgemsResults).reduce((sum, p) => sum + (p.loadTime > 0 ? p.loadTime : 0), 0) /
            Object.values(dgemsResults).filter((p) => p.loadTime > 0).length
        ),
        totalErrors: Object.values(dgemsResults).reduce((sum, p) => sum + p.errors.length, 0),
      },
      dgerApi: {
        totalPages: Object.keys(dgerApiResults).length,
        avgLoadTime: Math.round(
          Object.values(dgerApiResults).reduce((sum, p) => sum + (p.loadTime > 0 ? p.loadTime : 0), 0) /
            Object.values(dgerApiResults).filter((p) => p.loadTime > 0).length
        ),
        totalErrors: Object.values(dgerApiResults).reduce((sum, p) => sum + p.errors.length, 0),
      },
    },
    pageComparison: {} as Record<string, { dgems: PageInfo; dgerApi?: PageInfo }>,
    details: {
      dgems: dgemsResults,
      dgerApi: dgerApiResults,
    },
  };

  // 페이지별 비교
  for (const [pageName, dgemsPage] of Object.entries(dgemsResults)) {
    report.pageComparison[pageName] = {
      dgems: dgemsPage,
      dgerApi: dgerApiResults[pageName],
    };
  }

  // 리포트 저장
  const reportPath = path.join(OUTPUT_DIR, 'comparison-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  return report;
}

function printReport(report: ReturnType<typeof generateReport> extends Promise<infer T> ? T : never) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 사이트 비교 리포트');
  console.log('='.repeat(60));

  console.log('\n📈 요약:');
  console.log('┌─────────────────┬─────────────────┬─────────────────┐');
  console.log('│ 항목            │ DGEMS-map (New) │ dger-api (Old)  │');
  console.log('├─────────────────┼─────────────────┼─────────────────┤');
  console.log(`│ 페이지 수       │ ${String(report.summary.dgems.totalPages).padStart(15)} │ ${String(report.summary.dgerApi.totalPages).padStart(15)} │`);
  console.log(`│ 평균 로드시간   │ ${String(report.summary.dgems.avgLoadTime + 'ms').padStart(15)} │ ${String(report.summary.dgerApi.avgLoadTime + 'ms').padStart(15)} │`);
  console.log(`│ 총 에러 수      │ ${String(report.summary.dgems.totalErrors).padStart(15)} │ ${String(report.summary.dgerApi.totalErrors).padStart(15)} │`);
  console.log('└─────────────────┴─────────────────┴─────────────────┘');

  console.log('\n📄 페이지별 비교:');
  for (const [pageName, comparison] of Object.entries(report.pageComparison)) {
    console.log(`\n  [${pageName}]`);
    console.log(`    DGEMS-map: ${comparison.dgems.loadTime}ms, 버튼 ${comparison.dgems.elementCounts.buttons}개, 링크 ${comparison.dgems.elementCounts.links}개`);
    if (comparison.dgerApi) {
      console.log(`    dger-api:  ${comparison.dgerApi.loadTime}ms, 버튼 ${comparison.dgerApi.elementCounts.buttons}개, 링크 ${comparison.dgerApi.elementCounts.links}개`);
    } else {
      console.log(`    dger-api:  (해당 페이지 없음)`);
    }
  }

  console.log('\n📁 스크린샷 저장 위치:', OUTPUT_DIR);
  console.log('📋 상세 리포트:', path.join(OUTPUT_DIR, 'comparison-report.json'));
}

async function main() {
  console.log('🚀 사이트 비교 시작...');
  console.log(`   DGEMS-map: ${SITES.dgems.baseUrl}`);
  console.log(`   dger-api:  ${SITES.dgerApi.baseUrl}`);

  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });

  try {
    const dgemsResults = await captureScreenshots(browser, SITES.dgems, 'dgems');
    const dgerApiResults = await captureScreenshots(browser, SITES.dgerApi, 'dger-api');

    const report = await generateReport(dgemsResults, dgerApiResults);
    printReport(report);

    console.log('\n✅ 비교 완료!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await browser.close();
  }
}

main();
