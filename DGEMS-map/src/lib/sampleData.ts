/**
 * API 장애 시 사용할 샘플 데이터
 * 원본: dger-api/js/sever.js
 *
 * Graceful degradation을 위한 폴백 데이터
 */

export const SAMPLE_BED_DATA = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>SAMPLE DATA - API 연결 불가</resultMsg>
  </header>
  <body>
    <items>
      <item>
        <hpid>SAMPLE001</hpid>
        <dutyName>샘플병원1 (API 연결 확인 필요)</dutyName>
        <dutyAddr>샘플 주소</dutyAddr>
        <dutyTel3>000-0000-0000</dutyTel3>
        <dutyEmclsName>지역응급의료센터</dutyEmclsName>
        <hvec>5</hvec>
        <hvs01>20</hvs01>
        <hv27>2</hv27>
        <HVS59>5</HVS59>
        <hv29>1</hv29>
        <HVS03>3</HVS03>
        <hv30>1</hv30>
        <HVS04>3</HVS04>
        <hv28>2</hv28>
        <HVS02>5</HVS02>
        <hvidate>20240101120000</hvidate>
      </item>
      <item>
        <hpid>SAMPLE002</hpid>
        <dutyName>샘플병원2 (API 연결 확인 필요)</dutyName>
        <dutyAddr>샘플 주소</dutyAddr>
        <dutyTel3>000-0000-0000</dutyTel3>
        <dutyEmclsName>지역응급의료기관</dutyEmclsName>
        <hvec>3</hvec>
        <hvs01>15</hvs01>
        <hv27>1</hv27>
        <HVS59>3</HVS59>
        <hv29>0</hv29>
        <HVS03>2</HVS03>
        <hv30>0</hv30>
        <HVS04>2</HVS04>
        <hv28>1</hv28>
        <HVS02>3</HVS02>
        <hvidate>20240101120000</hvidate>
      </item>
    </items>
    <numOfRows>10</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>2</totalCount>
  </body>
</response>`;

export const SAMPLE_HOSPITAL_LIST = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>SAMPLE DATA - API 연결 불가</resultMsg>
  </header>
  <body>
    <items>
      <item>
        <hpid>SAMPLE001</hpid>
        <dutyName>샘플병원1 (API 연결 확인 필요)</dutyName>
        <dutyAddr>샘플 주소 1</dutyAddr>
        <dutyTel1>000-0000-0001</dutyTel1>
        <dutyTel3>000-0000-0001</dutyTel3>
        <dutyEmcls>HVS06</dutyEmcls>
        <dutyEmclsName>지역응급의료센터</dutyEmclsName>
        <wgs84Lat>35.8714</wgs84Lat>
        <wgs84Lon>128.6014</wgs84Lon>
      </item>
      <item>
        <hpid>SAMPLE002</hpid>
        <dutyName>샘플병원2 (API 연결 확인 필요)</dutyName>
        <dutyAddr>샘플 주소 2</dutyAddr>
        <dutyTel1>000-0000-0002</dutyTel1>
        <dutyTel3>000-0000-0002</dutyTel3>
        <dutyEmcls>HVS08</dutyEmcls>
        <dutyEmclsName>지역응급의료기관</dutyEmclsName>
        <wgs84Lat>35.8800</wgs84Lat>
        <wgs84Lon>128.6100</wgs84Lon>
      </item>
    </items>
    <numOfRows>10</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>2</totalCount>
  </body>
</response>`;

export const SAMPLE_MESSAGE_DATA = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>SAMPLE DATA - API 연결 불가</resultMsg>
  </header>
  <body>
    <items>
      <item>
        <symBlkMsg>[샘플] 현재 API 연결이 불가합니다. 잠시 후 다시 시도해주세요.</symBlkMsg>
        <symTypCod></symTypCod>
        <rnum>1</rnum>
      </item>
    </items>
    <numOfRows>10</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>1</totalCount>
  </body>
</response>`;

export const SAMPLE_SEVERE_DATA = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>SAMPLE DATA - API 연결 불가</resultMsg>
  </header>
  <body>
    <items>
      <item>
        <hpid>SAMPLE001</hpid>
        <dutyName>샘플병원1</dutyName>
        <MKioskTy1>Y</MKioskTy1>
        <MKioskTy2>Y</MKioskTy2>
        <MKioskTy3>N</MKioskTy3>
        <MKioskTy4>N</MKioskTy4>
        <MKioskTy5>Y</MKioskTy5>
        <MKioskTy6>Y</MKioskTy6>
        <MKioskTy7>Y</MKioskTy7>
        <MKioskTy8>Y</MKioskTy8>
        <MKioskTy9>Y</MKioskTy9>
        <MKioskTy10>N</MKioskTy10>
        <MKioskTy11>Y</MKioskTy11>
        <MKioskTy12>N</MKioskTy12>
        <MKioskTy13>Y</MKioskTy13>
        <MKioskTy14>N</MKioskTy14>
        <MKioskTy15>N</MKioskTy15>
        <MKioskTy16>Y</MKioskTy16>
        <MKioskTy17>Y</MKioskTy17>
        <MKioskTy18>Y</MKioskTy18>
        <MKioskTy19>N</MKioskTy19>
        <MKioskTy20>Y</MKioskTy20>
        <MKioskTy21>Y</MKioskTy21>
        <MKioskTy22>Y</MKioskTy22>
        <MKioskTy23>Y</MKioskTy23>
        <MKioskTy24>N</MKioskTy24>
        <MKioskTy25>Y</MKioskTy25>
        <MKioskTy26>Y</MKioskTy26>
        <MKioskTy27>N</MKioskTy27>
      </item>
    </items>
    <numOfRows>10</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>1</totalCount>
  </body>
</response>`;

/**
 * 샘플 데이터 여부 확인
 */
export function isSampleData(xmlText: string): boolean {
  return xmlText.includes('SAMPLE DATA') || xmlText.includes('샘플병원');
}
