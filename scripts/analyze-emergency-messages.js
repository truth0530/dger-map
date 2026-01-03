const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const BASE_URL = 'https://apis.data.go.kr/B552657/ErmctInfoInqireService/';
const REGION = process.env.TARGET_REGION || '대구광역시';
const OUTPUT_PATH = path.join(process.cwd(), 'scripts', 'emergency-messages-analysis.json');

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, '\n');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function safeDecodeServiceKey(key) {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function getApiKeys() {
  const rawKeys = [
    process.env.ERMCT_API_KEY,
    process.env.ERMCT_API_KEY_ALT,
    process.env.ERMCT_API_KEY2,
    process.env.ERMCT_API_KEY_2,
    process.env.ERMCT_API_KEY3,
    process.env.ERMCT_API_KEY_3,
    process.env.ERMCT_API_KEY_SECONDARY,
    process.env.ERMCT_API_KEY_THIRD,
    process.env.ERMCT_API_KEY_BACKUP,
  ]
    .map((key) => (typeof key === 'string' ? key.trim() : ''))
    .filter(Boolean);

  return Array.from(new Set(rawKeys));
}

function buildUrl(endpoint, params, apiKey) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  searchParams.set('serviceKey', safeDecodeServiceKey(apiKey));
  return `${BASE_URL}${endpoint}?${searchParams.toString()}`;
}

async function fetchXml(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

function parseXmlItems(xmlText) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xmlText);
  const items = parsed?.response?.body?.items?.item || [];
  if (Array.isArray(items)) return items;
  if (items) return [items];
  return [];
}

async function fetchBedInfo(apiKey) {
  const url = buildUrl('getEmrrmRltmUsefulSckbdInfoInqire', {
    STAGE1: REGION,
    numOfRows: 100,
    pageNo: 1,
    _type: 'xml',
  }, apiKey);

  const xml = await fetchXml(url);
  const items = parseXmlItems(xml);
  return items.map((item) => ({
    hpid: item.hpid,
    name: item.dutyName,
  })).filter((item) => item.hpid);
}

async function fetchMessagesForHospital(apiKey, hpid) {
  const url = buildUrl('getEmrrmSrsillDissMsgInqire', {
    HPID: hpid,
    numOfRows: 1000,
    _type: 'xml',
  }, apiKey);

  const xml = await fetchXml(url);
  const items = parseXmlItems(xml);
  return items
    .map((item) => (item.symBlkMsg || '').trim())
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadEnvFromFile(path.join(process.cwd(), '.env.local'));
  const apiKeys = getApiKeys();

  if (!apiKeys.length) {
    console.error('ERMCT API 키가 없습니다. .env.local 확인이 필요합니다.');
    process.exit(1);
  }

  const apiKey = apiKeys[0];
  console.log(`지역: ${REGION}`);

  const hospitals = await fetchBedInfo(apiKey);
  console.log(`병원 수: ${hospitals.length}`);

  const allMessages = [];
  for (let i = 0; i < hospitals.length; i++) {
    const { hpid, name } = hospitals[i];
    try {
      const messages = await fetchMessagesForHospital(apiKey, hpid);
      messages.forEach((msg) => {
        allMessages.push({ hpid, name, msg });
      });
    } catch (error) {
      console.warn(`메시지 조회 실패: ${hpid} (${name || 'unknown'}) - ${error.message || error}`);
    }

    if (i < hospitals.length - 1) {
      await sleep(150);
    }
  }

  const keywordRegex = /(문의|연락|확인|이송|내원|사전|수용여부|수용|전원|전화)/i;
  const filtered = allMessages.filter((item) => keywordRegex.test(item.msg));

  const normalized = (text) => text
    .replace(/\s+/g, ' ')
    .replace(/[.·ㆍ]/g, '')
    .trim();

  const uniqueMap = new Map();
  for (const item of filtered) {
    const key = normalized(item.msg);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { count: 0, samples: [] });
    }
    const entry = uniqueMap.get(key);
    entry.count += 1;
    if (entry.samples.length < 5) {
      entry.samples.push({ hpid: item.hpid, name: item.name, msg: item.msg });
    }
  }

  const uniqueList = Array.from(uniqueMap.entries())
    .map(([message, data]) => ({ message, count: data.count, samples: data.samples }))
    .sort((a, b) => b.count - a.count);

  const output = {
    region: REGION,
    hospitals: hospitals.length,
    totalMessages: allMessages.length,
    keywordMessages: filtered.length,
    uniqueMessages: uniqueList.length,
    messages: uniqueList,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`결과 저장: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
