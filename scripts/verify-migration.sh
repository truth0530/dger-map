#!/bin/bash
#
# DGER-MAP 마이그레이션 검증 스크립트
#
# 사용법:
#   ./scripts/verify-migration.sh              # 기본 (localhost:3000)
#   ./scripts/verify-migration.sh production   # 프로덕션 (dger.kr)
#   ./scripts/verify-migration.sh preview URL  # Preview 환경
#
# 종료 코드:
#   0 = 모든 테스트 통과
#   1 = 하나 이상 실패
#

# set -e 제거 - 개별 테스트 실패가 스크립트 중단 방지

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 환경 설정
ENV="${1:-local}"
case "$ENV" in
  production|prod)
    BASE_URL="https://dger.kr"
    ;;
  preview)
    BASE_URL="${2:-https://dger-map.vercel.app}"
    ;;
  *)
    BASE_URL="http://localhost:3000"
    ;;
esac

echo "========================================"
echo "  DGER-MAP 마이그레이션 검증"
echo "  환경: $ENV"
echo "  URL: $BASE_URL"
echo "========================================"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# 테스트 함수
test_url() {
  local name="$1"
  local url="$2"
  local expected="$3"

  response=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [ "$response" = "$expected" ]; then
    echo -e "${GREEN}✅ PASS${NC} [$response] $name"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} [$response != $expected] $name"
    ((FAILED++))
  fi
}

test_redirect() {
  local name="$1"
  local url="$2"
  local expected_location="$3"

  response=$(curl -sI "$url" 2>/dev/null)
  status=$(echo "$response" | head -1 | grep -o '[0-9]\{3\}' | head -1)
  location=$(echo "$response" | grep -i "^location:" | sed 's/location: //i' | tr -d '\r\n')

  if [ "$status" = "301" ] || [ "$status" = "308" ]; then
    if [[ "$location" == *"$expected_location"* ]]; then
      echo -e "${GREEN}✅ PASS${NC} [$status → $expected_location] $name"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠️ WARN${NC} [$status → $location != $expected_location] $name"
      ((WARNINGS++))
    fi
  else
    echo -e "${RED}❌ FAIL${NC} [$status != 301/308] $name"
    ((FAILED++))
  fi
}

test_api() {
  local name="$1"
  local url="$2"

  # HTTP 상태 코드 확인 (-s는 silent, -o /dev/null은 출력 버리기)
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

  if [ "$http_code" = "200" ]; then
    # 응답 크기 확인
    response_size=$(curl -s "$url" 2>/dev/null | wc -c | tr -d ' ')
    if [ "$response_size" -gt 100 ]; then
      echo -e "${GREEN}✅ PASS${NC} [HTTP 200, ${response_size}B] $name"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠️ WARN${NC} [HTTP 200, 응답 작음: ${response_size}B] $name"
      ((WARNINGS++))
    fi
  elif [ "$http_code" = "000" ]; then
    echo -e "${RED}❌ FAIL${NC} [연결 실패] $name"
    ((FAILED++))
  elif [ "$http_code" = "400" ]; then
    # 일부 API는 필수 파라미터 없이 400 반환 가능
    echo -e "${YELLOW}⚠️ WARN${NC} [HTTP 400 - 파라미터 확인 필요] $name"
    ((WARNINGS++))
  else
    echo -e "${RED}❌ FAIL${NC} [HTTP $http_code] $name"
    ((FAILED++))
  fi
}

test_health() {
  local url="$1/api/health"

  response=$(curl -sf "$url" 2>/dev/null)

  if [ -z "$response" ]; then
    echo -e "${YELLOW}⚠️ WARN${NC} [no /api/health endpoint] Health Check"
    ((WARNINGS++))
    return
  fi

  if command -v jq &> /dev/null; then
    status=$(echo "$response" | jq -r '.status' 2>/dev/null)
    if [ "$status" = "ok" ]; then
      echo -e "${GREEN}✅ PASS${NC} [status: ok] Health Check"
      ((PASSED++))
    elif [ "$status" = "degraded" ]; then
      echo -e "${YELLOW}⚠️ WARN${NC} [status: degraded - 선택 기능 제한] Health Check"
      ((WARNINGS++))
    else
      echo -e "${RED}❌ FAIL${NC} [status: $status] Health Check"
      ((FAILED++))
    fi
  else
    echo -e "${GREEN}✅ PASS${NC} [response received] Health Check"
    ((PASSED++))
  fi
}

echo "=== 1. Health Check ==="
test_health "$BASE_URL"
echo ""

echo "=== 2. 페이지 접근 테스트 ==="
test_url "메인 페이지 (/)" "$BASE_URL/" "200"
test_url "중증질환 (/severe)" "$BASE_URL/severe" "200"
test_url "응급메시지 (/messages)" "$BASE_URL/messages" "200"
test_url "피드백 (/feedback)" "$BASE_URL/feedback" "200"
echo ""

echo "=== 3. Redirect 테스트 ==="
test_redirect "/index.html → /" "$BASE_URL/index.html" "/"
test_redirect "/27severe.html → /severe" "$BASE_URL/27severe.html" "/severe"
test_redirect "/systommsg.html → /messages" "$BASE_URL/systommsg.html" "/messages"
test_redirect "/feed.html → /feedback" "$BASE_URL/feed.html" "/feedback"
echo ""

echo "=== 4. API 테스트 (신규 경로) ==="
test_api "병상정보 API" "$BASE_URL/api/bed-info?region=대구"
test_api "병원목록 API" "$BASE_URL/api/hospital-list"
test_api "응급메시지 API" "$BASE_URL/api/emergency-messages"
test_api "중증질환 API" "$BASE_URL/api/severe-diseases"
echo ""

echo "=== 5. API 테스트 (레거시 경로 - rewrite) ==="
test_api "레거시 병상정보" "$BASE_URL/api/get-bed-info?region=대구"
test_api "레거시 병원목록" "$BASE_URL/api/get-hospital-list"
test_api "레거시 응급메시지" "$BASE_URL/api/get-emergency-messages"
echo ""

echo "=== 6. 정적 파일 테스트 ==="
test_url "hosp_list.json" "$BASE_URL/data/hosp_list.json" "200"
test_url "favicon.svg" "$BASE_URL/favicon.svg" "200"
echo ""

echo "========================================"
echo "  결과 요약"
echo "========================================"
echo -e "  ${GREEN}통과: $PASSED${NC}"
echo -e "  ${RED}실패: $FAILED${NC}"
echo -e "  ${YELLOW}경고: $WARNINGS${NC}"
echo "========================================"

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}마이그레이션 검증 실패${NC}"
  exit 1
else
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}마이그레이션 검증 통과 (경고 있음)${NC}"
  else
    echo -e "${GREEN}마이그레이션 검증 통과${NC}"
  fi
  exit 0
fi
