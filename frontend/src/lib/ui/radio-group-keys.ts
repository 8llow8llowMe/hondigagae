import type { KeyboardEvent } from 'react'

/**
 * `role="radiogroup"` 의 키보드 규약 — WAI-ARIA Radio Group Pattern
 * ([#825](https://github.com/8llow8llowMe/hondigagae/issues/825)).
 *
 * 규약이 요구하는 것은 둘이다.
 *
 * 1. **roving `tabindex`** — 고른 칸만 `0`, 나머지는 `-1`. 묶음 전체가 **탭 스톱 하나**다.
 * 2. **화살표로 이동하고, 이동하면서 선택이 바뀐다.** 라디오 그룹의 기본 동작이다
 *    (체크박스 묶음과 갈리는 지점 — 거기는 이동과 선택이 따로다).
 *
 * 저장소 전체가 둘 다 어기고 있었다. 칸이 전부 탭 스톱이라 코스 목록에서 정렬 하나를
 * 지나가려면 **Tab 을 다섯 번** 눌러야 했고, 화살표는 아무 일도 하지 않았다.
 *
 * ### 왜 훅이 아니라 함수 둘인가
 *
 * 상태가 없다. 어느 칸이 고른 칸인지는 이미 각 사용처가 `selected` 로 알고, 지금 포커스가
 * 어디인지는 DOM 이 안다 — 훅이 따로 들고 있을 것이 없다. `ChipGroup` 처럼 `ref` 를 이미
 * 사용처(`useScrollRail`)에 내주고 있는 묶음도 있어, **`ref` 를 요구하지 않는 모양**이어야
 * 다섯 곳에 똑같이 붙는다. 그래서 묶음은 눌린 칸에서 `closest()` 로 거슬러 찾는다.
 *
 * ### 왜 묶음이 아니라 칸에 붙이는가
 *
 * APG 의 참조 구현이 그렇고, `jsx-a11y/interactive-supports-focus` 도 그것을 요구한다 —
 * `role="radiogroup"` 컨테이너에 `onKeyDown` 을 걸면 "포커스를 받을 수 없는 요소가 키를
 * 듣는다" 로 잡힌다. 칸은 `<button>` 이라 원래 포커스를 받고, 화살표는 **포커스가 있는
 * 칸에서** 눌린다 — 규약이 말하는 자리도 거기다. 덤으로 `tabIndex` 와 같은 자리에 붙어
 * 둘 중 하나만 빠뜨리기 어려워진다.
 *
 * ### 왜 순수 함수와 DOM 글루를 가른다
 *
 * 이 저장소는 jsdom 없이 `renderToStaticMarkup` 문자열로 단언한다 — **포커스가 실제로
 * 옮겨 갔는지는 유닛 테스트가 볼 수 없다.** 그래서 고를 수 있는 것(다음 칸이 몇 번인가)을
 * `nextRadioIndex` 로 떼어 유닛으로 촘촘히 잠그고, 옮기는 일(`focus()`·`click()`)만 e2e 가
 * 잰다. `lib/map/cluster.ts` 와 `map-canvas.tsx` 가 갈린 것과 같은 선이다.
 */

/** 다음 칸으로 (가로·세로 둘 다 받는다 — APG 가 라디오 그룹에 둘 다 허용한다) */
const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown'])
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp'])

/**
 * 키 하나가 포커스를 어디로 옮기는가. 옮기지 않는 키면 `null`.
 *
 * **끝에서 감는다(wrap).** APG 의 라디오 그룹 기본이고, 감지 않으면 마지막 칸에서 화살표가
 * 죽은 키가 된다 — 사용자는 그것을 "고장" 과 구분하지 못한다.
 *
 * `current` 가 범위 밖이면(`-1` 포함) `null` 이다 — 포커스가 묶음 밖에 있는데 키를
 * 가로채면 페이지 스크롤을 먹는다.
 */
export function nextRadioIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (current < 0 || current >= count) return null
  if (NEXT_KEYS.has(key)) return (current + 1) % count
  if (PREVIOUS_KEYS.has(key)) return (current - 1 + count) % count
  return null
}

/**
 * 고른 칸만 탭 스톱이다.
 *
 * **묶음에 고른 칸이 하나도 없으면 묶음 전체가 Tab 으로 닿지 않는다.** 지금 저장소의
 * 배타 묶음은 전부 `전체`·`상관없음` 같은 칸이 있어 언제나 하나가 고른 칸이고, 그 불변식을
 * `radio-group-keys.test.ts` 가 화면마다 잠근다 — 런타임에 고쳐 주는 대신 깨지면 빨간불이
 * 되게 둔다.
 */
export function radioTabIndex(selected: boolean): 0 | -1 {
  return selected ? 0 : -1
}

/**
 * 묶음 컨테이너의 `onKeyDown` 에 그대로 붙인다.
 *
 * **이동과 선택을 함께 한다** — 옮긴 칸을 `focus()` 하고 `click()` 한다. `click()` 으로
 * 고르는 이유는 각 사용처의 `onSelect` 가 이미 그 버튼에 매여 있어서다. 값 목록을 따로
 * 받지 않으므로 `FilterList` 처럼 `children` 만 받는 묶음에도 붙는다.
 */
export function handleRadioGroupKeyDown(event: KeyboardEvent<HTMLElement>): void {
  const group = event.currentTarget.closest('[role="radiogroup"]')
  if (group === null) return

  const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')].filter(
    (radio) => radio.getAttribute('aria-disabled') !== 'true' && !radio.hasAttribute('disabled'),
  )
  const moved = nextRadioIndex(event.key, radios.indexOf(event.currentTarget), radios.length)
  if (moved === null) return

  // 화살표가 페이지를 스크롤하지 않게 한다 — 이 키는 묶음 안에서 쓰였다
  event.preventDefault()
  radios[moved]?.focus()
  radios[moved]?.click()
}
