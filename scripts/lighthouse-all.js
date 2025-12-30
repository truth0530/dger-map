#!/usr/bin/env node
/**
 * Lighthouse 전체 페이지 성능 측정 스크립트
 *
 * 사용법:
 *   npm run perf:lighthouse
 *   node scripts/lighthouse-all.js
 *   node scripts/lighthouse-all.js --json  # JSON 출력
 *
 * 사전 조건:
 *   - 개발 서버가 localhost:3000에서 실행 중이어야 함
 *   - npm run dev로 서버 시작
 */

const { execSync } = require('child_process');

const PAGES = [
  { path: '/', name: '메인 (대시보드)' },
  { path: '/severe', name: '중증질환' },
  { path: '/messages', name: '응급메시지' },
  { path: '/map', name: '지도' },
  { path: '/feedback', name: '피드백' },
];

const BASE_URL = 'http://localhost:3000';
const isJsonOutput = process.argv.includes('--json');

async function measurePage(page) {
  const url = `${BASE_URL}${page.path}`;
  const cmd = `npx lighthouse ${url} --preset=desktop --only-categories=performance --output=json --quiet 2>/dev/null`;

  try {
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const result = JSON.parse(output);
    const perf = result.categories.performance;
    const audits = result.audits;

    return {
      page: page.path,
      name: page.name,
      score: Math.round(perf.score * 100),
      metrics: {
        FCP: audits['first-contentful-paint'].displayValue,
        LCP: audits['largest-contentful-paint'].displayValue,
        TBT: audits['total-blocking-time'].displayValue,
        CLS: audits['cumulative-layout-shift'].displayValue,
        SI: audits['speed-index'].displayValue,
        TTI: audits['interactive'].displayValue,
      }
    };
  } catch (error) {
    return {
      page: page.path,
      name: page.name,
      score: null,
      error: error.message,
    };
  }
}

function printTable(results) {
  console.log('\n=== Lighthouse Performance Results ===\n');
  console.log('| 페이지 | 점수 | FCP | LCP | TBT | CLS | SI | TTI |');
  console.log('|--------|------|-----|-----|-----|-----|-----|-----|');

  for (const r of results) {
    if (r.error) {
      console.log(`| ${r.name} | ERROR | - | - | - | - | - | - |`);
    } else {
      const m = r.metrics;
      const scoreEmoji = r.score >= 90 ? '🟢' : r.score >= 50 ? '🟡' : '🔴';
      console.log(`| ${r.name} | ${scoreEmoji} ${r.score} | ${m.FCP} | ${m.LCP} | ${m.TBT} | ${m.CLS} | ${m.SI} | ${m.TTI} |`);
    }
  }

  console.log('\n📊 Core Web Vitals 기준:');
  console.log('  - FCP (First Contentful Paint): < 1.8s (Good)');
  console.log('  - LCP (Largest Contentful Paint): < 2.5s (Good)');
  console.log('  - TBT (Total Blocking Time): < 200ms (Good)');
  console.log('  - CLS (Cumulative Layout Shift): < 0.1 (Good)');
  console.log('  - 점수: 🟢 90+ | 🟡 50-89 | 🔴 <50\n');
}

async function main() {
  console.log('🔍 Lighthouse 성능 측정 시작...\n');
  console.log(`측정 대상: ${PAGES.map(p => p.path).join(', ')}`);
  console.log('(각 페이지당 약 15-30초 소요)\n');

  const results = [];

  for (const page of PAGES) {
    process.stdout.write(`📍 ${page.name} (${page.path}) 측정 중...`);
    const result = await measurePage(page);
    results.push(result);

    if (result.error) {
      console.log(' ❌ 실패');
    } else {
      console.log(` ✅ ${result.score}점`);
    }
  }

  if (isJsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printTable(results);
  }

  // 요약 통계
  const validResults = results.filter(r => !r.error);
  if (validResults.length > 0) {
    const avgScore = Math.round(validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length);
    console.log(`📈 평균 점수: ${avgScore}점`);
    console.log(`📅 측정일시: ${new Date().toLocaleString('ko-KR')}\n`);
  }
}

main().catch(console.error);
