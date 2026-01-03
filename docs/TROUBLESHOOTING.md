# 트러블슈팅 가이드 - 교훈 모음

이 문서는 프로젝트 개발 중 발생한 주요 문제들과 해결 과정에서 얻은 교훈을 기록합니다.

**목적**: 같은 실수를 반복하지 않기 위한 교훈 정리

---

## 핵심 교훈 요약

### 1. 전역 CSS는 재앙의 시작

> **`globals.css`에서 element 선택자(`button`, `input`, `select`)에 크기/폰트 스타일을 적용하지 마라**

```css
/* ❌ 절대 금지 */
button { @apply h-10 text-sm; }
input { @apply h-10 text-sm; }

/* ✅ 컴포넌트에서 개별 제어 */
```

**피해 사례**: shadcn Select, Combobox, Button의 크기/폰트가 아무리 className을 바꿔도 변경되지 않음

### 2. CSS transform 충돌을 조심하라

> **라이브러리가 `transform`으로 위치를 지정하는 요소에 다른 transform을 적용하면 위치가 초기화된다**

```css
/* ❌ Leaflet 마커 위치 초기화됨 */
.leaflet-marker-icon { transform: scale(1.3); }

/* ✅ 내부 요소에만 적용 */
.leaflet-marker-icon .inner { transform: scale(1.3); }
```

**피해 사례**: Leaflet 마커가 (0,0)에서 발사되는 "갤러그 총알" 현상

### 3. 이벤트 타입을 정확히 선택하라

| 목적 | 올바른 이벤트 |
|------|--------------|
| 마커/버튼 호버 | `mouseenter`/`mouseleave` |
| 자식 포함 전체 감지 | `mouseover`/`mouseout` |

**피해 사례**: mouseover/mouseout 사용으로 마커 깜빡임 발생

### 4. 2시간 규칙

> **같은 문제로 2시간 이상 고생하면 외부 전문가에게 문의하라**

라이브러리 내부 메커니즘은 문서화되지 않은 경우가 많다.
직접 찾는 것보다 전문가에게 물어보는 것이 훨씬 빠르다.

---

## 문제별 상세 가이드

| 문제 | 상세 문서 |
|------|----------|
| shadcn 컴포넌트 크기/폰트 변경 안됨 | [shadcn-styling-guide.md](./shadcn-styling-guide.md) |
| Leaflet 마커 호버 깜빡임/총알 현상 | [leaflet-marker-hover-fix.md](./leaflet-marker-hover-fix.md) |

---

## 디버깅 체크리스트

문제가 발생했을 때 순서대로 확인:

### CSS 관련 문제

- [ ] 브라우저 DevTools에서 **computed style** 확인
- [ ] 어떤 CSS 규칙이 적용되었는지 확인 (Styles 탭)
- [ ] `globals.css`에서 전역 스타일 확인
- [ ] `!important` 사용 여부 확인
- [ ] CSS specificity(우선순위) 확인

### JavaScript/이벤트 문제

- [ ] 콘솔에서 이벤트 발생 빈도 로깅
- [ ] 이벤트 버블링 여부 확인
- [ ] React useEffect 의존성 배열 확인
- [ ] 불필요한 리렌더링 여부 확인

### 라이브러리 관련 문제

- [ ] 라이브러리의 DOM 구조 파악 (Elements 탭)
- [ ] 라이브러리가 어떤 요소에 스타일을 적용하는지 확인
- [ ] 유사 라이브러리(잘 동작하는 것)와 비교
- [ ] 공식 문서에서 관련 내용 검색
- [ ] GitHub Issues 검색

---

## 히스토리

| 날짜 | 문제 | 해결 시간 | 외부 도움 |
|------|------|----------|----------|
| 2024.12.29 | shadcn Select/Combobox 크기 조절 | 수 시간 | Yes |
| 2024.12.30 | Leaflet 마커 호버 깜빡임 | 수 시간 | Yes |

---

## 앞으로의 다짐

1. **전역 CSS 수정 시 극도로 신중하게**
2. **라이브러리 사용 전 DOM 구조와 스타일링 방식 파악**
3. **문제 해결 후 반드시 문서화**
4. **2시간 넘으면 혼자 끙끙대지 말고 도움 요청**
