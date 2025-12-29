#!/bin/bash
#
# API 응답 동등성 검증 스크립트
#
# dger-api와 dger-map의 API 응답을 비교하여
# 필드/타입 차이를 찾아냅니다.
#
# 사용법:
#   ./scripts/compare-api-responses.sh
#
# 필요 도구:
#   - curl
#   - jq (JSON 처리)
#   - diff
#
# 비교 방식:
#   1. 양쪽에서 동일 API 호출
#   2. 응답 구조(키) 비교
#   3. 값 타입 비교
#   4. 차이점 리포트
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 환경 설정 (필요시 수정)
DGER_API_URL="${DGER_API_URL:-https://dger.kr}"
DGER_MAP_URL="${DGER_MAP_URL:-http://localhost:3000}"

# 임시 파일 디렉토리
TMP_DIR="/tmp/dger-api-compare"
mkdir -p "$TMP_DIR"

echo "========================================"
echo "  API 응답 동등성 검증"
echo "========================================"
echo "  dger-api: $DGER_API_URL"
echo "  dger-map: $DGER_MAP_URL"
echo "========================================"
echo ""

# jq 설치 확인
if ! command -v jq &> /dev/null; then
  echo -e "${RED}오류: jq가 설치되어 있지 않습니다.${NC}"
  echo "설치: brew install jq (macOS) 또는 apt install jq (Linux)"
  exit 1
fi

# API 목록
declare -A APIS
APIS["bed-info"]="/api/get-bed-info?region=대구"
APIS["hospital-list"]="/api/get-hospital-list"
APIS["emergency-messages"]="/api/get-emergency-messages"
APIS["severe-diseases"]="/api/get-severe-diseases"

# 키 구조 추출 함수 (재귀적)
extract_keys() {
  jq -r 'paths(scalars) | join(".")' 2>/dev/null | sort | uniq
}

# 타입 구조 추출 함수
extract_types() {
  jq -r '
    def type_of:
      if type == "array" then
        if length > 0 then "array<" + (.[0] | type_of) + ">"
        else "array<empty>"
        end
      elif type == "object" then "object"
      else type
      end;
    paths(scalars) as $p | "\($p | join(".")): \(getpath($p) | type)"
  ' 2>/dev/null | sort | uniq
}

# API 비교 함수
compare_api() {
  local name="$1"
  local endpoint="$2"

  echo -e "${BLUE}=== $name ===${NC}"

  # 양쪽 API 호출
  local api_response="$TMP_DIR/${name}_api.json"
  local map_response="$TMP_DIR/${name}_map.json"
  local api_keys="$TMP_DIR/${name}_api_keys.txt"
  local map_keys="$TMP_DIR/${name}_map_keys.txt"

  echo -n "  dger-api 호출... "
  if curl -sf "$DGER_API_URL$endpoint" > "$api_response" 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}FAIL${NC}"
    echo "  → dger-api 응답 없음, 비교 건너뜀"
    echo ""
    return
  fi

  echo -n "  dger-map 호출... "
  if curl -sf "$DGER_MAP_URL$endpoint" > "$map_response" 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}FAIL${NC}"
    echo "  → dger-map 응답 없음, 비교 건너뜀"
    echo ""
    return
  fi

  # 키 구조 추출
  cat "$api_response" | extract_keys > "$api_keys"
  cat "$map_response" | extract_keys > "$map_keys"

  # 차이점 비교
  local api_only=$(comm -23 "$api_keys" "$map_keys" | head -10)
  local map_only=$(comm -13 "$api_keys" "$map_keys" | head -10)

  if [ -z "$api_only" ] && [ -z "$map_only" ]; then
    echo -e "  ${GREEN}✅ 키 구조 일치${NC}"
  else
    if [ -n "$api_only" ]; then
      echo -e "  ${YELLOW}⚠️ dger-api에만 있는 키:${NC}"
      echo "$api_only" | while read key; do
        echo "     - $key"
      done
    fi
    if [ -n "$map_only" ]; then
      echo -e "  ${YELLOW}⚠️ dger-map에만 있는 키:${NC}"
      echo "$map_only" | while read key; do
        echo "     - $key"
      done
    fi
  fi

  # 첫 번째 레코드 구조 비교 (배열인 경우)
  local api_first=$(jq -c '.data[0] // .hospitals[0] // .items[0] // null' "$api_response" 2>/dev/null)
  local map_first=$(jq -c '.data[0] // .hospitals[0] // .items[0] // null' "$map_response" 2>/dev/null)

  if [ "$api_first" != "null" ] && [ "$map_first" != "null" ]; then
    local api_fields=$(echo "$api_first" | jq -r 'keys[]' 2>/dev/null | sort)
    local map_fields=$(echo "$map_first" | jq -r 'keys[]' 2>/dev/null | sort)

    if [ "$api_fields" = "$map_fields" ]; then
      echo -e "  ${GREEN}✅ 데이터 필드 일치${NC}"
    else
      echo -e "  ${YELLOW}⚠️ 데이터 필드 차이 있음${NC}"
      echo "     API: $(echo $api_first | jq -r 'keys | length') 필드"
      echo "     MAP: $(echo $map_first | jq -r 'keys | length') 필드"
    fi
  fi

  # 레코드 수 비교
  local api_count=$(jq '.data | length // .hospitals | length // 0' "$api_response" 2>/dev/null)
  local map_count=$(jq '.data | length // .hospitals | length // 0' "$map_response" 2>/dev/null)

  if [ "$api_count" != "0" ] || [ "$map_count" != "0" ]; then
    if [ "$api_count" = "$map_count" ]; then
      echo -e "  ${GREEN}✅ 레코드 수 일치: $api_count${NC}"
    else
      echo -e "  ${YELLOW}⚠️ 레코드 수 차이: API=$api_count, MAP=$map_count${NC}"
    fi
  fi

  echo ""
}

# 각 API 비교 실행
for name in "${!APIS[@]}"; do
  compare_api "$name" "${APIS[$name]}"
done

echo "========================================"
echo "  상세 비교 명령어"
echo "========================================"
echo ""
echo "# 전체 응답 비교 (직접 실행)"
echo "diff <(curl -s $DGER_API_URL/api/get-bed-info?region=대구 | jq -S .) \\"
echo "     <(curl -s $DGER_MAP_URL/api/bed-info?region=대구 | jq -S .)"
echo ""
echo "# 특정 필드만 비교"
echo "curl -s $DGER_API_URL/api/get-bed-info?region=대구 | jq '.data[0] | keys'"
echo "curl -s $DGER_MAP_URL/api/bed-info?region=대구 | jq '.data[0] | keys'"
echo ""
echo "# 임시 파일 위치: $TMP_DIR/"
echo "========================================"

# 정리
echo ""
echo "임시 파일 정리하려면: rm -rf $TMP_DIR"
