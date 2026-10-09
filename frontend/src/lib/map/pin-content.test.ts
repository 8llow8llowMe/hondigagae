import { describe, expect, it } from 'vitest'

import {
  clusterContent,
  focusMarkerContent,
  PIN_NAME_MAX_LEVEL,
  pinContent,
  pinShape,
} from '@/lib/map/pin-content'
import { messages } from '@/lib/messages'

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

/*
  **기준점 마커** (#1223). 담기 지도가 그날 기준점에서 열리는데 그 자리에 표시가 없어, 왜 여기서
  열렸는지 알 수 없었다. 장소가 아니라 "지도를 연 자리" 라 고를 것이 없다.
*/
describe('focusMarkerContent — 기준점 마커 (#1223)', () => {
  const content = focusMarkerContent('카멜리아힐')

  it('누를 수 없다 — 버튼이 아니고 눌림 상태도 없다', () => {
    expect(content.tag).toBe('div')
    expect(content.role).toBe('img')
    expect(content.ariaPressed).toBeNull()
    expect(content.className).toContain('map-pin-static')
  })

  it('장소 핀과 다른 모양이다 — 같은 클래스만이면 장소로 읽힌다', () => {
    expect(content.className).toContain('map-pin-focus')
    expect(content.className).not.toContain('map-pin-selected')
  })

  it('보이는 글자가 기준점이라고 말한다 — 이름만이면 장소 이름표와 구별되지 않는다', () => {
    expect(content.label).toBe(messages.map.focusMarkerText.replace('{name}', '카멜리아힐'))
    expect(content.text).toBeNull()
  })

  it('보조기기 이름도 같은 말이다', () => {
    expect(content.ariaLabel).toBe(messages.map.focusMarkerLabel.replace('{name}', '카멜리아힐'))
  })
})

describe('pinContent — 카테고리 아이콘 원 (#1280)', () => {
  const dot = { title: '사라봉공원', icon: 'landscape' as const }
  const on = { selected: false, interactive: true }

  it('아이콘이 있으면 원 갈래다 — 예전 이름표 클래스를 쓰지 않는다', () => {
    const content = pinContent(dot, on)

    expect(content.icon).toBe('landscape')
    expect(content.className.split(' ')).toContain('map-pin-dot')
    expect(content.className.split(' ')).not.toContain('map-pin')
  })

  it('이름은 숨어 있어도 늘 장소명이다 — 버튼의 접근 이름이 된다', () => {
    const content = pinContent(dot, on)

    expect(content.label).toBe('사라봉공원')
    expect(content.ariaLabel).toBeNull()
    expect(content.className.split(' ')).not.toContain('map-pin-dot-named')
  })

  it('named 면 이름을 상시 연다', () => {
    expect(pinContent({ ...dot, named: true }, on).className.split(' ')).toContain(
      'map-pin-dot-named',
    )
  })

  it('선택되면 줌과 상관없이 이름을 열고 캡션을 붙인다', () => {
    const content = pinContent({ ...dot, caption: '480m' }, { selected: true, interactive: true })
    const classes = content.className.split(' ')

    expect(classes).toEqual(
      expect.arrayContaining(['map-pin-dot', 'map-pin-dot-named', 'map-pin-dot-selected']),
    )
    expect(classes).not.toContain('map-pin-selected')
    expect(content.label).toBe('사라봉공원 · 480m')
    expect(content.ariaPressed).toBe(true)
  })

  it('흐림은 원 전용 수식어다 — map-pin-muted 의 이름표 규칙이 새지 않는다', () => {
    const classes = pinContent({ ...dot, muted: true }, on).className.split(' ')

    expect(classes).toContain('map-pin-dot-muted')
    expect(classes).not.toContain('map-pin-muted')
  })

  it('아이콘이 없는 핀은 예전 이름표 그대로다 — 정적 핀 · 기준점과 같은 갈래', () => {
    const content = pinContent({ title: '제주동물병원', caption: '1.2km' }, on)

    expect(content.icon).toBeNull()
    expect(content.className).toBe('map-pin')
  })

  it('순번이 있으면 아이콘보다 순번이 먼저다', () => {
    const content = pinContent({ ...dot, order: 2 }, on)

    expect(content.className.split(' ')).toContain('map-pin-order')
    expect(content.icon).toBeNull()
  })

  it('묶음 · 기준점 서술자도 icon 필드를 낸다(null)', () => {
    expect(clusterContent(3).icon).toBeNull()
    expect(focusMarkerContent('수월봉').icon).toBeNull()
  })

  it('이름이 서는 줌은 level 6 이하다', () => {
    expect(PIN_NAME_MAX_LEVEL).toBe(6)
  })
})

describe('pinContent — 시설 사각 (#1286 D2-1)', () => {
  const square = { title: '제주24시동물병원', icon: 'cross' as const, shape: 'square' as const }
  const on = { selected: false, interactive: true }

  it('사각 갈래는 원 핀 클래스 위에 수식어 하나를 얹는다', () => {
    const content = pinContent(square, on)

    expect(content.className).toBe('map-pin-dot map-pin-dot-square')
    expect(content.icon).toBe('cross')
    expect(content.label).toBe('제주24시동물병원')
  })

  it('선택 · 흐림 · named 수식어를 원 핀과 똑같이 받는다', () => {
    const selected = pinContent({ ...square, muted: true }, { selected: true, interactive: true })
    const classes = selected.className.split(' ')

    expect(classes).toEqual(
      expect.arrayContaining([
        'map-pin-dot',
        'map-pin-dot-square',
        'map-pin-dot-named',
        'map-pin-dot-selected',
        'map-pin-dot-muted',
      ]),
    )
    expect(selected.ariaPressed).toBe(true)
    expect(pinContent({ ...square, named: true }, on).className.split(' ')).toContain(
      'map-pin-dot-named',
    )
  })

  it('원 핀(모양 없음 · circle)에는 사각 수식어가 붙지 않는다', () => {
    const dot = { title: '사라봉공원', icon: 'landscape' as const }

    expect(pinContent(dot, on).className.split(' ')).not.toContain('map-pin-dot-square')
    expect(pinContent({ ...dot, shape: 'circle' as const }, on).className.split(' ')).not.toContain(
      'map-pin-dot-square',
    )
  })

  /* 아이콘은 "무엇", 모양은 "어느 층" — 아이콘 없는 핀에서 shape 는 뜻이 없다 (D7-1) */
  it('아이콘 없는 핀은 shape 를 무시한다 — 예전 이름표 그대로다', () => {
    const content = pinContent({ title: '제주동물병원', shape: 'square' }, on)

    expect(content.className).toBe('map-pin')
    expect(pinShape({ shape: 'square' })).toBe('circle')
  })

  it('pinShape — 아이콘과 square 가 함께 있을 때만 사각이다', () => {
    expect(pinShape(square)).toBe('square')
    expect(pinShape({ icon: 'pill' })).toBe('circle')
    expect(pinShape({ icon: 'pill', shape: 'circle' })).toBe('circle')
  })

  it('누를 수 없는 지도에서도 사각이고 정적 수식어가 붙는다', () => {
    const content = pinContent(square, { selected: false, interactive: false })

    expect(content.tag).toBe('div')
    expect(content.className.split(' ')).toEqual(
      expect.arrayContaining(['map-pin-dot', 'map-pin-dot-square', 'map-pin-static']),
    )
  })
})

describe('clusterContent — 시설 사각 묶음 (#1286 D2-3)', () => {
  it('사각이면 map-cluster 위에 사각 수식어를 얹는다', () => {
    expect(clusterContent(12, 'square').className).toBe('map-cluster map-cluster-square')
  })

  it('모양을 주지 않으면 원 묶음 그대로다', () => {
    expect(clusterContent(12).className).toBe('map-cluster')
    expect(clusterContent(12, 'circle').className).toBe('map-cluster')
  })

  it('문구 틀을 받으면 무엇을 세는지 이름이 말한다 — 보이는 숫자는 그대로', () => {
    const content = clusterContent(135, 'square', messages.map.facilityClusterCount)

    expect(content.text).toBe('99+')
    expect(content.ariaLabel).toBe('이 지역 병원·약국 99+곳')
    expect(content.tag).toBe('button')
    expect(content.ariaPressed).toBeNull()
  })

  it('틀을 주지 않으면 장소 묶음 문구다', () => {
    expect(clusterContent(7, 'square').ariaLabel).toBe(
      messages.map.clusterCount.replace('{n}', '7'),
    )
  })
})
