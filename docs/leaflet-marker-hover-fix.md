# Leaflet 마커 호버 깜빡임/총알 발사 현상 해결 가이드

## 개요

Leaflet 지도에서 마커 호버 시 발생하는 깜빡임 현상과 마커가 (0,0) 위치에서 발사되는 듯한 현상의 원인과 해결 방법을 기록합니다.

**해결 일자**: 2024.12.30
**문제 해결에 소요된 시간**: 수 시간 (외부 전문가 도움으로 최종 해결)

---

## 문제 현상

### 1. "따발총" 현상
- 마커 사이를 호버할 때 무한대로 깜빡거림
- 가까이 있는 마커들 사이에서 특히 심함
- mouseover/mouseout 이벤트가 계속 발생

### 2. "갤러그 총알" 현상
- 마커가 화면 좌측 상단(0,0)에서 현재 위치로 날아오는 애니메이션
- 마치 게임에서 총알이 발사되는 것처럼 보임
- 호버할 때마다 반복 발생

---

## 시도한 해결책들 (실패)

### 1. 이벤트 버블링 방지
```javascript
// ❌ 효과 없음
marker.on('mouseover', (e) => {
  e.originalEvent.stopPropagation();
  // ...
});
```

### 2. 디바운싱/쓰로틀링
```javascript
// ❌ 효과 없음 - 근본 원인이 아님
const debouncedHover = debounce((code) => {
  onHospitalHover(code);
}, 50);
```

### 3. CSS transition 제거 (부분 효과)
```css
/* △ 부분적 효과 - 총알 현상만 약간 완화 */
.leaflet-marker-icon {
  transition: none !important;
}
```

### 4. createPopupContent 의존성 제거
```javascript
// △ 마커 재생성 빈도는 줄었으나 깜빡임은 여전
// useEffect 의존성 배열에서 createPopupContent 제거
useEffect(() => {
  // ...
}, [leafletLoaded, hospitals, bedDataMap, isDark]); // createPopupContent 제거
```

---

## 근본 원인 분석 (핵심!)

### 원인 1: CSS transform 충돌

**Leaflet의 마커 위치 지정 방식**:
```html
<!-- Leaflet이 자동으로 적용하는 스타일 -->
<div class="leaflet-marker-icon" style="transform: translate3d(523px, 412px, 0px);">
  <div class="maplibre-marker">...</div>
</div>
```

**문제가 된 호버 CSS**:
```css
/* ❌ 문제의 코드 */
.leaflet-marker-icon.marker-hovered {
  transform: scale(1.3) !important;  /* Leaflet의 translate3d를 완전히 덮어씀! */
}
```

**결과**: `transform: scale(1.3)`이 `transform: translate3d(523px, 412px, 0px)`를 **완전히 대체**하여 마커가 (0,0) 위치로 이동

### 원인 2: Leaflet 이벤트 vs 네이티브 DOM 이벤트

```javascript
// ❌ Leaflet 이벤트 - 자식 요소에서 버블링되어 깜빡임 발생
marker.on('mouseover', () => { ... });
marker.on('mouseout', () => { ... });

// ✅ 네이티브 DOM 이벤트 - 버블링 없음
markerDom.addEventListener('mouseenter', () => { ... });
markerDom.addEventListener('mouseleave', () => { ... });
```

`mouseover`/`mouseout`은 자식 요소에서도 발생하여 버블링되지만,
`mouseenter`/`mouseleave`는 실제 요소 진입/이탈 시에만 발생합니다.

---

## 최종 해결책

### 1. CSS 수정 - 내부 요소에만 transform 적용

```css
/* ✅ 해결된 코드 - popup.css */

/*
 * 핵심: Leaflet은 .leaflet-marker-icon에 transform: translate3d(...)로 위치를 지정함
 * 따라서 이 요소에 transform을 적용하면 위치가 (0,0)으로 초기화됨
 * 해결: 내부 .maplibre-marker 요소에만 scale을 적용
 */

/* Leaflet 아이콘 컨테이너 - transform 건드리지 않음, z-index만 조정 */
.leaflet-marker-icon.marker-hovered {
  z-index: 1000 !important;
  /* transform 절대 사용 금지! */
}

/* Leaflet 위치 애니메이션 비활성화 */
.leaflet-marker-icon,
.leaflet-zoom-animated {
  transition: none !important;
}

/* 내부 마커 요소에만 scale 적용 - Leaflet의 translate 유지 */
.leaflet-marker-icon .maplibre-marker {
  transition: transform 0.1s ease-out, filter 0.1s ease-out;
}

.leaflet-marker-icon.marker-hovered .maplibre-marker {
  transform: scale(1.3);
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
}
```

### 2. JavaScript 수정 - 네이티브 DOM 이벤트 사용

```typescript
// ✅ 해결된 코드 - LeafletMap.tsx

// 마커 DOM 요소 참조
const markerDom = customMarker.getElement();

// 네이티브 DOM 이벤트 사용 (mouseenter/mouseleave)
if (markerDom) {
  markerDom.addEventListener('mouseenter', () => {
    // 팝업 표시
    if (popupRef.current) {
      popupRef.current.remove();
    }
    popupRef.current = window.L.popup({...})
      .setLatLng([hospital.lat, hospital.lng])
      .setContent(createPopupContentRef.current?.(hospital, isDark) || '')
      .addTo(mapInstance.current);

    onHospitalHoverRef.current?.(hospital.code);
  });

  markerDom.addEventListener('mouseleave', () => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    onHospitalHoverRef.current?.(null);
  });
}
```

### 3. Ref 패턴으로 불필요한 재렌더링 방지

```typescript
// ✅ createPopupContent를 ref로 관리
const createPopupContentRef = useRef<((hospital: Hospital, isDarkMode?: boolean) => string) | null>(null);

// ref 업데이트
useEffect(() => {
  createPopupContentRef.current = createPopupContent;
}, [createPopupContent]);

// 마커 생성 useEffect에서는 ref 사용
useEffect(() => {
  // ...
  .setContent(createPopupContentRef.current?.(hospital, isDark) || '')
  // ...
}, [leafletLoaded, hospitals, bedDataMap, isDark]); // createPopupContent 제거됨
```

---

## MapLibre와의 비교

MapLibre에서는 동일한 문제가 발생하지 않는 이유:

| 항목 | Leaflet | MapLibre |
|------|---------|----------|
| 마커 위치 지정 | `.leaflet-marker-icon`에 `transform: translate3d()` | 별도 레이어 시스템 |
| CSS transform 충돌 | **발생** | 발생하지 않음 |
| DOM 이벤트 | Leaflet 자체 이벤트 시스템 | 네이티브 이벤트 |

---

## 핵심 교훈

### 1. Leaflet의 transform 메커니즘 이해 필수

> **Leaflet은 `.leaflet-marker-icon` 요소에 `transform: translate3d()`로 마커 위치를 지정한다.**
> **이 요소에 다른 transform을 적용하면 위치가 초기화된다!**

### 2. CSS transform 적용 시 주의사항

```css
/* ❌ 절대 금지 - Leaflet 마커 컨테이너에 직접 transform */
.leaflet-marker-icon {
  transform: scale(1.3);
}

/* ✅ 올바른 방법 - 내부 요소에만 transform */
.leaflet-marker-icon .inner-element {
  transform: scale(1.3);
}
```

### 3. 이벤트 타입 선택

| 이벤트 | 특징 | 사용 시점 |
|--------|------|----------|
| `mouseover`/`mouseout` | 자식 요소에서 버블링 | 자식 포함 전체 영역 감지 필요 시 |
| `mouseenter`/`mouseleave` | 버블링 없음 | **마커 호버 등 정확한 진입/이탈 감지 시** |

### 4. 디버깅 순서

1. **브라우저 DevTools에서 computed style 확인**
   - 실제 적용된 `transform` 값 확인
   - 어떤 CSS 규칙이 적용되었는지 확인

2. **라이브러리의 DOM 구조 파악**
   - Leaflet이 어떤 요소에 스타일을 적용하는지
   - 어떤 요소가 위치/크기를 결정하는지

3. **유사 라이브러리와 비교**
   - MapLibre와 같이 잘 동작하는 구현과 비교
   - 차이점 분석

### 5. 외부 도움 요청 시점

> **2시간 이상 같은 문제로 고생하면 외부 전문가에게 문의하라**
>
> 이 문제의 경우 Leaflet의 내부 동작 방식을 알아야 해결 가능했음.
> 라이브러리 내부 메커니즘은 문서화되지 않은 경우가 많아
> 직접 찾기 어려울 수 있음.

---

## 지도 스타일 메모

- Leaflet의 `neutral`, `osm` 스타일은 밝은 배경에 시커먼 줄이 두드러져 UI에 어울리지 않음
- 다음에도 쓰지 않을 지도 스타일로 분류하고 메뉴에서 제거

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/maplibre/LeafletMap.tsx` | Leaflet 지도 컴포넌트 |
| `src/styles/popup.css` | 마커 및 팝업 스타일 |

---

## 참고 자료

- Leaflet 마커는 CSS `transform`으로 위치가 지정됨
- `translate3d()`는 GPU 가속을 위해 사용됨
- CSS `transform` 속성은 하나의 값만 가질 수 있음 (여러 변환은 공백으로 구분하여 하나의 값으로)
