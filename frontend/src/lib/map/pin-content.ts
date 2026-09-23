/**
 * 핀 하나를 **무엇으로 그릴지**의 판단 — 이슈 [#789](https://github.com/8llow8llowMe/hondigagae/issues/789).
 *
 * ### 왜 `map-canvas.tsx` 밖인가
 *
 * 오버레이 내용은 `CustomOverlay` 가 `HTMLElement` 만 받아서 DOM API 로 조립한다 — React
 * 트리 밖이라 **`environment: 'node'` 인 이 저장소의 vitest 로는 볼 수 없다**
 * (`docs/testing-guide.md` §1: `document` 가 없다). 그래서 잠글 수 없는 자리였고, 실제로
 * `<button aria-pressed>` 가 **누를 것이 없는 지도 둘**에 그려지는 것을 아무도 못 잡았다.
 *
 * 판단만 순수 함수로 떼면 그 자리가 테스트에 들어온다. 조립(`pinElement`)은 이 결과를
 * 그대로 옮기기만 하므로, 남는 위험은 "옮기다 빠뜨림" 뿐이고 그것은 눈으로 보인다.
 * `cluster.ts` · `stacking.ts` 와 같은 분할이다.
 *
 * ### 입력 타입을 `MapPin` 으로 받지 않는다
 *
 * `MapPin` 은 `features/map/map-canvas.tsx` 에 있다. `lib/` 이 `features/` 를 가져오면
 * 층이 뒤집힌다 — 쓰는 필드만 구조적으로 적는다 (`MapPin` 이 그대로 대입된다).
 */

import { clusterMarkerLabel, clusterMarkerText } from '@/lib/map/cluster'

/** 이 판단이 쓰는 필드만. `MapPin` 이 구조적으로 대입된다 */
export type PinContentInput = {
  title: string
  /** 선택됐을 때 이름표에 함께 붙는 보조 문구 (예: `480m`) */
  caption?: string | null
  /** 낮춤 표현. 긴급 시설의 약국이 쓴다 */
  muted?: boolean
  /** 동선의 순번(#743). 있으면 고르기 전까지 숫자 원이다 */
  order?: number
}

export type PinContent = {
  /** `button` 은 고를 것이 있을 때만. 그 외에는 `div` + `role="img"` (#789) */
  tag: 'button' | 'div'
  role: 'img' | null
  className: string
  /** 요소에 직접 넣는 글자 (순번 원). 이름표 갈래는 `null` 이고 `label` 이 대신한다 */
  text: string | null
  /** 안쪽 `span` 에 들어가는 이름표 글자. 순번 원 갈래는 `null` */
  label: string | null
  ariaLabel: string | null
  /** **버튼일 때만 값이 있다.** 누를 수 없는 것의 눌림 상태는 거짓말이다 */
  ariaPressed: boolean | null
}

export function pinContent(
  pin: PinContentInput,
  { selected, interactive }: { selected: boolean; interactive: boolean },
): PinContent {
  const base = {
    tag: interactive ? ('button' as const) : ('div' as const),
    role: interactive ? null : ('img' as const),
    ariaPressed: interactive ? selected : null,
  }

  /*
    **순번 핀은 고르기 전까지 숫자 원이다.** 고르면 이름표로 바뀐다 — 원 안에 이름이
    들어가지 않고, 이름이 필요한 순간은 사용자가 그 핀을 지목한 때뿐이다.

    `aria-label` 은 **갈래와 무관하게** 붙는다. 보이는 글자가 순번 숫자뿐이라 버튼일
    때도 이름이 따로 필요하다 — 여기가 `role` 없는 `<span>` 을 고르지 못한 이유이기도
    하다(generic 요소는 `aria-label` 을 이름으로 노출하지 않는다).
  */
  if (pin.order !== undefined && !selected) {
    return {
      ...base,
      className: classNames(['map-pin-order'], interactive),
      text: String(pin.order),
      label: null,
      ariaLabel: `${String(pin.order)}. ${pin.title}`,
    }
  }

  const caption = pin.caption ?? null
  const name = selected && caption !== null ? `${pin.title} · ${caption}` : pin.title

  return {
    ...base,
    className: classNames(
      ['map-pin', selected && 'map-pin-selected', pin.muted === true && 'map-pin-muted'],
      interactive,
    ),
    text: null,
    label: name,
    /*
      **버튼은 이름을 안쪽 텍스트로 얻는다** — 그때 `aria-label` 을 겹쳐 붙이면 같은
      글자가 두 채널에서 오고, 둘이 어긋나는 날 텍스트 쪽이 조용히 진다. `role="img"`
      갈래에서만 붙인다 (그쪽은 안쪽 텍스트가 가려져 이것이 유일한 이름이다).
    */
    ariaLabel: interactive ? null : name,
  }
}

/**
 * 묶음 마커 — 이슈 #671 F-5.
 *
 * **지름 32 숫자 원형 마커다** (진단 E-1 [P0] · 시안 §3 ①). 누르면 그 구역으로 확대한다.
 * 라벨 알약("이 지역 42곳")이었을 때는 폭이 글자 수만큼 늘어 390px 밀집 구간에서 서로
 * 덮었다. 폭을 고정하면 겹침 면적이 줄고, **개수가 늘어도 그 폭이 변하지 않는다.**
 *
 * **문구를 지우는 것이 아니라 옮긴다** — 보이는 글자는 숫자뿐이고, "무엇이 몇 곳인지" 는
 * `aria-label` 이 말한다. 시각 사용자에게는 `.map-cluster::after` 의 겹친 원이 "여럿" 을
 * 말한다 (#671 C-4 — `aria-label` 만으로는 §1 을 지키지 못한다).
 *
 * ### 왜 `pinContent` 와 같은 타입인가
 *
 * 이 서술자를 DOM 으로 바르는 자리가 `map-canvas.tsx` 에 **하나뿐이어야** 하기 때문이다.
 * 이전에는 `clusterElement` 가 따로 있어서 `textContent` 와 `aria-label` 을 직접 꽂았고,
 * **그 배선은 어느 테스트도 보지 않았다** — 둘을 바꿔 꽂아도 초록이었다 (#671 F-5).
 * 순수 함수(`clusterMarkerText` · `clusterMarkerLabel`)만 잠겨 있었지 배선은 아니었다.
 *
 * 같은 타입으로 맞추면 applier 가 하나로 합쳐지고, 그 applier 가 이미 `pin-content.test.ts`
 * 로 잠긴 규칙(태그·역할·이름·글자)을 묶음에도 그대로 적용한다.
 */
export function clusterContent(count: number): PinContent {
  return {
    /** 누르면 그 구역으로 확대한다 — 늘 할 일이 있으므로 늘 버튼이다 */
    tag: 'button',
    /** 버튼은 `role` 을 덮어쓰지 않는다. `role="img"` 는 누를 것이 없는 핀의 것이다 (#789) */
    role: null,
    className: 'map-cluster',
    text: clusterMarkerText(count),
    /** 이름표 `span` 이 없다 — 원 안에 들어가는 것은 숫자뿐이다 */
    label: null,
    ariaLabel: clusterMarkerLabel(count),
    /**
     * **토글이 아니다.** 핀은 고름/안 고름이 있어 `aria-pressed` 를 말하지만, 묶음을
     * 누르면 지도가 확대되고 그 묶음은 사라진다 — 눌린 채로 남는 상태가 없다.
     */
    ariaPressed: null,
  }
}

/** 고를 것이 없는 지도의 핀에는 `.map-pin-static` 이 따라붙는다 (#789) */
function classNames(names: (string | false)[], interactive: boolean): string {
  return [...names, !interactive && 'map-pin-static'].filter((name) => name !== false).join(' ')
}
