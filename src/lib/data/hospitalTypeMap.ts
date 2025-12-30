/**
 * 병원 유형 매핑 (서버 측)
 * 사전 변환된 경량 JSON (hospitalTypeMapping.json)에서 직접 로드
 * - 빌드 시 번들에 포함되어 fs.readFileSync 불필요
 * - Edge 런타임 호환
 * - 217KB → 15KB (93% 감소)
 */

import hospitalTypeMapping from './hospitalTypeMapping.json';

export type HospitalOrgType = '권역응급의료센터' | '지역응급의료센터' | '전문응급의료센터' | '지역응급의료기관' | '';

// 타입 단언 (JSON은 Record<string, string>)
const mapping = hospitalTypeMapping as Record<string, string>;

/**
 * 병원 코드로 유형 조회
 */
export function getHospitalOrgType(hpid: string): HospitalOrgType {
  return (mapping[hpid] || '') as HospitalOrgType;
}

/**
 * 하위 호환성: 맵 형태로 반환
 */
export function loadHospitalTypeMap(): Map<string, HospitalOrgType> {
  const map = new Map<string, HospitalOrgType>();
  for (const [hpid, orgType] of Object.entries(mapping)) {
    map.set(hpid, orgType as HospitalOrgType);
  }
  return map;
}
