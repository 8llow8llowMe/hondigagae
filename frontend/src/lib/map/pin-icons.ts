/**
 * 지도 핀 안의 아이콘 — 이슈 #1280 (`docs/features/place/지도핀-세부명세.md` D2-1).
 *
 * **React 컴포넌트가 아니라 문자열이다.** 핀은 카카오 `CustomOverlay` 에 넘기는 DOM 이라 React 트리
 * 밖이다(`pin-content.ts` 머리주석). `markerElement` 가 이 **고정 문자열**만 붙인다 — 사용자 데이터가
 * 마크업에 섞이지 않는다(이름은 `textContent`).
 *
 * **키는 모양이다** — 지도 층은 장소 분류를 모른다. 어느 장소를 어느 모양으로 그릴지는
 * `lib/place/pin-icon.ts` 가, 어느 시설을 어느 모양으로 그릴지는 `lib/emergency/facility-pin.ts` 가 정한다. 결은 `components/icons` 와 같다(24 · 선 1.5 · `currentColor`).
 */
export type MapPinIcon =
  | 'landscape'
  | 'utensils'
  | 'coffee'
  | 'bed'
  | 'museum'
  | 'flag'
  | 'footprints'
  | 'bike'
  | 'bag'
  | 'pin'
  | 'cross'
  | 'pill'

const PATHS: Record<MapPinIcon, string> = {
  // 산 두 봉우리 — 세로 8–17 로 격자 가운데에 앉힌다(10–19 는 원 안에서 아래로 처져 보였다)
  landscape: '<path d="M3 17l6-9 4 5 2-3 6 7z"/>',
  // 수저
  utensils: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-1.7 0-3 2-3 5s1.3 4 3 4v9"/>',
  // 커피잔
  coffee:
    '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
  // 침대
  bed: '<path d="M3 18v-8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>',
  // 기둥 건물
  museum: '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
  // 깃발
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
  // 신발 자국 두 개 — 발바닥 + 뒤꿈치. 타원 둘이면 14px 에서 `0 0` 으로 읽혔다(#1280 실측)
  footprints:
    '<path d="M7 2c2 0 3.5 2 3.5 4.5S9 10 9 12H5c0-2-1.5-3-1.5-5.5S5 2 7 2zM5 14.5h4a2 2 0 0 1-4 0zM17 7c2 0 3.5 2 3.5 4.5S19 15 19 17h-4c0-2-1.5-3-1.5-5.5S15 7 17 7zM15 19.5h4a2 2 0 0 1-4 0z"/>',
  // 자전거
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3 7M9 6h3"/>',
  // 쇼핑백
  bag: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  // 범용 — `components/icons` 의 PinIcon 과 같은 그림
  pin: '<path d="M12 21s6.5-5.6 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.5"/>',
  /*
    동물병원 — **채운 십자** (#1286 D2-2). 선 1.5 십자는 14px 에서 0.9px 이라 사라진다 — 굵은 더하기를
    면으로 칠한다. 바깥 `<svg>` 의 `stroke` 를 이 도형만 끈다.
  */
  cross:
    '<path fill="currentColor" stroke="none" d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/>',
  // 동물약국 — 45° 기운 캡슐 + 가운데 가름선 (#1286 D2-2)
  pill: '<g transform="rotate(-45 12 12)"><path d="M7 8.5h10a3.5 3.5 0 0 1 0 7H7a3.5 3.5 0 0 1 0-7zM12 8.5v7"/></g>',
}

export const MAP_PIN_ICONS = Object.keys(PATHS) as readonly MapPinIcon[]

export function pinIconSvg(icon: MapPinIcon): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[icon]}</svg>`
}
