# shadcn/ui 컴포넌트 스타일링 가이드

## 개요

shadcn/ui 컴포넌트의 크기나 스타일을 변경할 때 자주 발생하는 문제와 해결 방법을 기록합니다.

---

## 문제: 외부 className이 적용되지 않음

### 증상
- `h-5`, `h-6` 등의 height 클래스를 전달해도 컴포넌트 크기가 변하지 않음
- Tailwind 클래스가 무시되는 것처럼 보임

### 원인 1: 전역 CSS 스타일 (globals.css)

`globals.css`에서 전역 선택자로 스타일을 강제 적용하면 컴포넌트 레벨 스타일을 덮어씁니다.

```css
/* ❌ 문제가 되는 코드 */
input, textarea, select {
  @apply h-10 w-full rounded-md ...;
}

[role="combobox"],
[class*="Select"] {
  @apply h-10 ...;
}
```

**해결책**: 전역 스타일에서 height 등 크기 관련 속성 제거

```css
/* ✅ 수정된 코드 */
input, textarea {
  @apply w-full rounded-md ...;  /* h-10 제거, select 제거 */
}

/* 선택 드롭다운 스타일 완전 제거 */
```

### 원인 2: data 속성 선택자의 높은 우선순위

shadcn 컴포넌트가 `data-*` 속성 선택자를 사용하면 일반 클래스보다 CSS 우선순위가 높습니다.

```tsx
// select.tsx 내부
className={cn(
  "... data-[size=default]:h-9 data-[size=sm]:h-8 ...",
  className  // 외부 className이 와도 data 선택자에 밀림
)}
```

**해결책**: 컴포넌트에 size prop 추가

```tsx
// ✅ select.tsx 수정
function SelectTrigger({
  size = "default",  // size prop 추가
  ...
}: ... & { size?: "xs" | "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-size={size}
      className={cn(
        "... data-[size=xs]:h-6 data-[size=xs]:px-2 data-[size=xs]:text-[10px] ...",
        className
      )}
    />
  )
}
```

### 원인 3: class-variance-authority (cva) variants

Button 등의 컴포넌트가 cva를 사용할 때 variants에 정의된 스타일이 우선 적용됩니다.

```tsx
// button.tsx
const buttonVariants = cva("...", {
  variants: {
    size: {
      default: "h-10 px-4 py-2",  // 이 스타일이 적용됨
      sm: "h-9 rounded-md px-3",
    },
  },
  defaultVariants: {
    size: "default",  // 기본값으로 h-10 적용
  },
})
```

**해결책**: 새로운 size variant 추가

```tsx
// ✅ button.tsx 수정
size: {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  xs: "h-6 rounded px-2 py-0.5 text-[10px]",  // 추가
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
},
```

---

## 해결 체크리스트

shadcn 컴포넌트 크기가 변경되지 않을 때:

1. **globals.css 확인**
   - [ ] 전역 선택자 (`input`, `select`, `[role="combobox"]` 등)에서 height 강제 적용 여부
   - [ ] `!important` 사용 여부

2. **컴포넌트 내부 확인**
   - [ ] `data-[size=*]` 속성 선택자 사용 여부
   - [ ] cva variants에 size 정의 여부

3. **해결 방법**
   - [ ] 전역 CSS에서 크기 관련 스타일 제거
   - [ ] 컴포넌트에 새로운 size variant 추가 (xs, sm 등)
   - [ ] 사용하는 곳에서 `size="xs"` prop 전달

---

## 🚨 핵심 발견 (2024.12.29) - 가장 중요!

### 문제: 폰트 사이즈가 절대 변경되지 않음

`text-[8px]`, `text-[10px]` 등의 Tailwind 클래스를 아무리 적용해도 폰트 사이즈가 14px에서 변하지 않는 현상.

### 근본 원인: globals.css의 전역 `text-sm` 클래스

```css
/* ❌ 문제의 코드 - globals.css */
button {
  @apply rounded-md text-sm font-medium transition-colors ...;
  /*             ^^^^^^^ 이것이 모든 버튼 폰트를 14px로 강제! */
}

input, textarea {
  @apply w-full rounded-md border px-3 py-2 text-sm ...;
  /*                                        ^^^^^^^ input도 마찬가지 */
}
```

**`text-sm`은 Tailwind에서 `font-size: 0.875rem` (14px)로 변환됩니다.**

전역 element 선택자(`button`, `input`)에 적용된 스타일은:
- 컴포넌트 레벨의 className보다 CSS specificity가 같거나 높음
- `@apply` 내의 클래스가 먼저 적용되어 후속 클래스를 덮어씀

### 해결책

```css
/* ✅ 수정된 코드 - globals.css */
button {
  @apply rounded-md font-medium transition-colors ...;
  /* text-sm 제거! 폰트 사이즈는 각 컴포넌트에서 제어 */
}

input, textarea {
  @apply w-full rounded-md border px-3 py-2 ...;
  /* text-sm 제거! */
}
```

### 교훈

1. **전역 스타일에서 `font-size` 관련 클래스 사용 금지** (`text-sm`, `text-xs` 등)
2. **컴포넌트 스타일 변경 전 항상 globals.css 확인**
3. **브라우저 DevTools에서 실제 computed style 확인 필수**
4. 기존 가이드의 height(`h-10`) 문제와 동일한 패턴이 font-size에도 적용됨

---

## 실제 수정 사례 (2024.12)

### 수정된 파일들

| 파일 | 변경 내용 |
|------|----------|
| `globals.css` | `h-10` 전역 스타일 제거, select 관련 전역 스타일 제거, **`text-sm` 제거** |
| `button.tsx` | `size: "xs"`, `size: "xxs"` variant 추가 |
| `select.tsx` | `size` prop 추가, `data-[size=xs]`, `data-[size=xxs]` 스타일 추가 |
| `combobox.tsx` | `size` prop 추가 및 Button에 전달 |
| `MapDashboard.tsx` | 모든 Select/Combobox에 `size="xs"` 적용 |

### 적용 예시

```tsx
// 컴팩트한 Select
<Select value={value} onValueChange={onChange}>
  <SelectTrigger size="xs" className="border bg-gray-800">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {options.map(opt => (
      <SelectItem key={opt.value} value={opt.value}>
        {opt.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// 컴팩트한 Combobox
<Combobox
  options={options}
  value={value}
  onValueChange={onChange}
  size="xs"
  triggerClassName="border bg-gray-800"
/>
```

---

## 주의사항

1. **Tailwind CSS JIT**: 동적 클래스 (`data-[size=xs]:h-6`)는 소스 코드에 문자열로 존재해야 생성됨
2. **CSS 우선순위**: `data-*` 선택자 > 일반 클래스 > 기본 스타일
3. **테스트**: 변경 후 반드시 브라우저 DevTools에서 실제 적용된 스타일 확인
