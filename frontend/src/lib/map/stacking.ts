/**
 * 지도 오버레이의 쌓임 순서.
 *
 * ### 왜 표현식을 `map-canvas.tsx` 밖으로 뺐나
 *
 * **여기가 이슈 [#671](https://github.com/8llow8llowMe/hondigagae/issues/671) A-1 이 난
 * 자리다.** `zIndex: isCluster ? 2 : selected ? 10 : 1` 은 한 줄에 축이 둘(묶음인가 ·
 * 고른 것인가) 섞인 삼항이라, *"원이 통째로 덮여 누를 수 없는 묶음이 된다"* 는 근거를
 * 적어 둔 바로 그 주석 밑에서 **선택 핀 축만 빠뜨린 채** 8개월을 살아남았다. 커밋 제목은
 * *"작아진 묶음 마커가 덮이거나 헛눌리지 않게 잡는다"* 였는데 실제로 잡힌 것은 한 축뿐이다.
 *
 * 순서는 **눈으로 확인하기 가장 어려운 종류의 규칙**이다 — 묶음과 선택 핀이 겹치는
 * 구간을 지도에서 만들어야 보이고, 그마저도 확대 단계에 따라 나타났다 사라진다
 * (`cluster.ts` 머리주석이 격자 묶음을 순수 함수로 뺀 것과 같은 이유다).
 *
 * ### 값이 아니라 순서가 계약이다
 *
 * 숫자 자체에는 의미가 없다. 지켜야 하는 것은 **묶음 > 선택 핀 > 일반 핀 > 선** 이고,
 * `stacking.test.ts` 가 단언하는 것도 그 부등식이다.
 */

/**
 * 층. 카카오 `CustomOverlay.zIndex` · `Polyline.zIndex` 에 그대로 넘긴다.
 *
 * **`cluster` 가 `selectedPin` 위다** (#671 A-1). 선택 핀은 이름표라 가로로 길고
 * (`.map-pin-selected` `max-width: 260px`) 묶음은 32px 원이라, 선택 핀이 위에 서면
 * **겹침 가로폭이 언제나 원 전체 폭**이 되어 원이 통째로 사라진다 — 실측 면적 53%
 * 잠식에 `elementFromPoint(원 중심)` 이 이름표를 돌려줬다. 반대로 원이 위에 서면 잃는
 * 것은 이름표 32px 뿐이고, 남는 폭으로 계속 읽힌다.
 *
 * 묶음을 눌러야 그 아래 개별 핀에 닿을 수 있다는 점에서 의미상으로도 이 순서가 맞다.
 *
 * 선(`route`)은 맨 아래다. 선이 핀을 덮으면 이름표가 잘려 읽히지 않는다.
 */
export const MAP_LAYER_Z = {
  route: 0,
  pin: 1,
  selectedPin: 10,
  cluster: 11,
} as const

/** 마커 하나의 층. 축 둘(묶음인가 · 고른 것인가)을 **이 순서로** 본다 */
export function markerZIndex({
  isCluster,
  selected,
}: {
  isCluster: boolean
  selected: boolean
}): number {
  // 묶음 판정이 먼저다 — 묶음 안에 고른 핀이 섞여도 원이 맨 위여야 한다
  if (isCluster) return MAP_LAYER_Z.cluster
  return selected ? MAP_LAYER_Z.selectedPin : MAP_LAYER_Z.pin
}
