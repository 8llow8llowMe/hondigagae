import { describe, expect, it } from 'vitest'

import { clusterContent, pinContent } from '@/lib/map/pin-content'

/**
 * 핀이 무엇으로 그려지는가 — 이슈 [#789](https://github.com/8llow8llowMe/hondigagae/issues/789).
 *
 * **DOM 조립(`map-canvas.tsx` 의 `pinElement`)이 아니라 판단만 본다.** 이 저장소의 vitest 는
 * `environment: 'node'` 라 `document` 가 없다 (`docs/testing-guide.md` §1) — 그래서 판단을
 * 순수 함수로 떼어 여기서 잠그고, 조립은 그 결과를 그대로 옮기기만 한다.
 */

const PLACE = { title: '협재해수욕장' }
const STOP = { title: '협재해수욕장', order: 3 }

describe('pinContent — 고를 것이 있는 지도 (목록형 3종)', () => {
  it('버튼이다 — 눌러서 목록과 대응시킨다', () => {
    expect(pinContent(PLACE, { selected: false, interactive: true }).tag).toBe('button')
  })

  it('눌림 상태를 말한다 — 고른 핀과 아닌 핀이 갈린다', () => {
    expect(pinContent(PLACE, { selected: true, interactive: true }).ariaPressed).toBe(true)
    expect(pinContent(PLACE, { selected: false, interactive: true }).ariaPressed).toBe(false)
  })

  it('선택되면 이름표에 캡션이 붙는다', () => {
    const content = pinContent({ ...PLACE, caption: '480m' }, { selected: true, interactive: true })

    expect(content.label).toBe('협재해수욕장 · 480m')
  })

  it('선택 전에는 캡션을 붙이지 않는다 — 이름만으로 좁은 폭을 지킨다', () => {
    const content = pinContent(
      { ...PLACE, caption: '480m' },
      { selected: false, interactive: true },
    )

    expect(content.label).toBe('협재해수욕장')
  })

  /** 순번 핀은 보이는 글자가 숫자뿐이라 이름이 따로 필요하다 (#743) */
  it('순번 핀은 숫자를 쓰고 이름은 aria-label 로 말한다', () => {
    const content = pinContent(STOP, { selected: false, interactive: true })

    expect(content.text).toBe('3')
    expect(content.ariaLabel).toBe('3. 협재해수욕장')
  })

  it('순번 핀도 고르면 이름표로 바뀐다 — 원 안에 이름이 들어가지 않는다', () => {
    const content = pinContent(STOP, { selected: true, interactive: true })

    expect(content.className).toContain('map-pin-selected')
    expect(content.label).toBe('협재해수욕장')
  })

  it('.map-pin-static 을 붙이지 않는다 — 여기는 여전히 누르는 자리다', () => {
    for (const selected of [true, false]) {
      expect(pinContent(PLACE, { selected, interactive: true }).className).not.toContain(
        'map-pin-static',
      )
      expect(pinContent(STOP, { selected, interactive: true }).className).not.toContain(
        'map-pin-static',
      )
    }
  })
})

describe('pinContent — 고를 것이 없는 지도 (단일 핀 미니 지도)', () => {
  const single = pinContent(PLACE, { selected: true, interactive: false })

  /** 수용 기준: **Tab 이 핀에 멈추지 않는다** — 버튼이 아니면 포커스 순서에 끼지 않는다 */
  it('버튼이 아니다 — 눌러도 아무 일 없는 정류장을 만들지 않는다', () => {
    expect(single.tag).toBe('div')
  })

  /** 수용 기준: **스크린리더가 눌린 토글로 읽지 않는다** */
  it('눌림 상태를 말하지 않는다 — 무엇이 눌려 있다는 짝이 화면에 없다', () => {
    expect(single.ariaPressed).toBeNull()
  })

  /**
   * 수용 기준: **이름은 그대로 읽는다.** `role="img"` 가 안쪽 텍스트를 가리므로
   * `aria-label` 이 유일한 이름이 된다 — 여기가 비면 지도가 통째로 익명이 된다.
   */
  it('이름을 aria-label 로 옮겨 적는다 — 버튼이 텍스트로 주던 그 이름이다', () => {
    expect(single.role).toBe('img')
    expect(single.ariaLabel).toBe('협재해수욕장')
    expect(single.label).toBe('협재해수욕장')
  })

  it('캡션이 있으면 이름에도 함께 들어간다 — 눈에 보이는 글자와 같아야 한다', () => {
    const content = pinContent(
      { ...PLACE, caption: '480m' },
      { selected: true, interactive: false },
    )

    expect(content.ariaLabel).toBe('협재해수욕장 · 480m')
    expect(content.ariaLabel).toBe(content.label)
  })

  it('.map-pin-static 이 붙는다 — 손 모양 커서와 44 히트 영역을 뗀다', () => {
    expect(single.className).toContain('map-pin-static')
  })

  /**
   * 오늘 이 조합을 만드는 화면은 없다(순번 핀을 쓰는 동선 지도는 `onSelect` 를 준다).
   * 그래도 **`role` 없는 순수 `<span>` 을 고르지 않은 이유가 바로 이 갈래다** —
   * `aria-label` 은 generic 요소에서 이름으로 노출되지 않아 "3" 만 읽히게 된다.
   */
  it('순번 핀도 이름을 잃지 않는다', () => {
    const content = pinContent(STOP, { selected: false, interactive: false })

    expect(content.role).toBe('img')
    expect(content.ariaLabel).toBe('3. 협재해수욕장')
  })
})

/**
 * 묶음 마커 — 이슈 [#671](https://github.com/8llow8llowMe/hondigagae/issues/671) F-5.
 *
 * `clusterMarkerText` · `clusterMarkerLabel` 자체는 `cluster.test.ts` 가 잠갔지만,
 * **그 둘이 어느 채널로 나가는가**(보이는 글자냐 이름이냐)는 `map-canvas.tsx` 의 DOM
 * 조립 안에 있어서 아무도 보지 않았다 — 바꿔 꽂아도 초록이었다. 판단을 `clusterContent`
 * 로 빼면서 여기로 들어온다.
 */
describe('clusterContent — 묶음 마커', () => {
  it('보이는 글자는 숫자뿐이다 — 원 안에 "이 지역 …곳" 이 들어가면 알약으로 돌아간다', () => {
    expect(clusterContent(42).text).toBe('42')
    expect(clusterContent(42).label).toBeNull()
  })

  it('"무엇이 몇 곳인지" 는 이름이 말한다 — 두 채널을 바꿔 꽂으면 여기서 깨진다', () => {
    const content = clusterContent(42)

    expect(content.ariaLabel).toBe('이 지역 42곳')
    expect(content.ariaLabel).not.toBe(content.text)
  })

  /*
    **접힌 묶음에서도 이름이 보이는 글자를 담는다** — WCAG 2.5.3(Label in Name).
    원에 `99+` 가 보이는데 이름이 `이 지역 1200곳` 이면 음성 입력 사용자가 화면에서
    읽은 대로 부를 수 없다. 정확한 개수는 눌러서 확대하면 마커가 갈라지며 드러난다.
  */
  it('접힌 묶음은 이름도 접힌 글자를 담는다', () => {
    const content = clusterContent(1200)

    expect(content.text).toBe('99+')
    expect(content.ariaLabel).toBe('이 지역 99+곳')
    expect(content.ariaLabel).toContain(content.text)
  })

  /** #671 D-1 이 상한을 `999` 에서 `99` 로 내렸다 — 현(弦) 예산 28.69px 을 네 글자가 넘는다 */
  it('세 자리부터 접는다 — D-1 의 새 상한이 이 배선에도 그대로 온다', () => {
    expect(clusterContent(99).text).toBe('99')
    expect(clusterContent(100).text).toBe('99+')
  })

  it('버튼이다 — 누르면 그 구역으로 확대한다', () => {
    expect(clusterContent(42).tag).toBe('button')
  })

  /**
   * **토글이 아니다.** 누르면 지도가 확대되고 그 묶음은 사라진다 — 눌린 채로 남는 상태가
   * 없다. `aria-pressed` 가 붙으면 보조기기가 "눌리지 않음" 을 계속 읽는다.
   */
  it('눌림 상태를 말하지 않는다', () => {
    expect(clusterContent(42).ariaPressed).toBeNull()
  })

  it('버튼이므로 role 을 덮어쓰지 않는다 — role="img" 는 누를 것이 없는 핀의 것이다', () => {
    expect(clusterContent(42).role).toBeNull()
  })

  /** `.map-cluster::after` 의 겹친 원이 여기 붙는다 (#671 C-4) */
  it('.map-cluster 다 — 순번 핀(.map-pin-order)과 클래스가 갈린다', () => {
    expect(clusterContent(42).className).toBe('map-cluster')
    expect(pinContent(STOP, { selected: false, interactive: true }).className).toContain(
      'map-pin-order',
    )
  })
})
