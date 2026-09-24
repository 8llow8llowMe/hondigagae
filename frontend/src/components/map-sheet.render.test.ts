import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  MAP_TOP_CONTROLS_INSET,
  MapSheet,
  SHEET_STOPS,
  type SheetStop,
  shouldStartSheetDrag,
} from '@/components/map-sheet'
import { messages } from '@/lib/messages'

// 이 파일은 화면과 무관한 범용 동작(단계 전환·모달 아님)만 검증한다 —
// 이름 자체는 호출부마다 다르므로(`src/components/map-sheet.test.ts`) 임의 값을 쓴다.
//
// 두 축(이름·max 상한)을 다 받아야 해서 **옵션 객체**다. 위치 인자로 두면 어느 쪽을
// 넘기는지가 호출부에서 안 읽힌다.
function render(
  stop: SheetStop,
  { label = '목록', maxTopInset }: { label?: string; maxTopInset?: number } = {},
) {
  return renderToStaticMarkup(
    createElement(MapSheet, {
      label,
      stop,
      onStopChange: () => undefined,
      header: createElement('p', null, '지도에 보이는 곳 8'),
      children: createElement('p', null, '목록 자리'),
      ...(maxTopInset === undefined ? {} : { maxTopInset }),
    }),
  )
}

describe('MapSheet — 단계가 화면을 바꾼다', () => {
  it('단계마다 높이가 다르고 위로 갈수록 커진다', () => {
    const height = (markup: string) => Number(/calc\((\d+(?:\.\d+)?)dvh/.exec(markup)?.[1] ?? 0)

    expect(height(render('min'))).toBeLessThan(height(render('mid')))
    expect(height(render('mid'))).toBeLessThan(height(render('max')))
  })

  /**
   * #883 이 뒤집은 규칙이다. 예전에는 최소 단계에서만 탭바 위였고 그 위 단계에서는
   * 시트가 `bottom-0` 으로 탭바를 덮었다 — 시트를 올리는 순간 하단 내비게이션이 통째로
   * 사라졌다. 세 단계 모두 탭바를 비운다.
   */
  it('어느 단계에서도 탭바 자리를 비운다', () => {
    expect(render('min')).toContain('map-sheet-clears-tabbar')
    expect(render('mid')).toContain('map-sheet-clears-tabbar')
    expect(render('max')).toContain('map-sheet-clears-tabbar')
    // 바닥을 0 으로 내리는 갈래가 남아 있으면 그 단계만 다시 탭바를 덮는다
    expect(render('mid')).not.toContain('bottom-0')
    expect(render('max')).not.toContain('bottom-0')
  })

  /**
   * **바닥만 올리면 윗변이 함께 올라간다.** 그러면 `/places` 의 상단 컨트롤
   * (`absolute top-5`)을 시트가 덮는다 — 812 실측으로 `max` 상단이 y=122 → y=58.
   * 높이에서 탭바 몫을 빼서 윗변을 제자리에 둔다.
   */
  it('mid·max 는 높이에서 탭바 몫을 뺀다 — 윗변이 그대로 있어야 한다', () => {
    expect(render('mid')).toContain('var(--map-sheet-tabbar')
    expect(render('max')).toContain('var(--map-sheet-tabbar')
  })

  /**
   * 최소 단계는 옛 규칙에서도 탭바 위였다 — 여기서 또 빼면 20dvh(812 기기에서 162px)가
   * 98px 로 줄어, #883 이 늘리려는 바로 그 본문 높이를 깎는다.
   */
  it('min 은 빼지 않는다 — 원래 탭바 위였고 높이가 그대로여야 한다', () => {
    expect(render('min')).not.toContain('var(--map-sheet-tabbar')
  })

  /**
   * 층 결정 자체가 이 이슈의 산출물이다 (#883). `z-50`(오버레이)이던 근거는 "탭바 위에
   * 선다" 하나였고 그 결정을 되받았으므로, 시트는 탭바(`z-40`) 아래 `z-30` 이다.
   */
  it('탭바보다 아래 층이다 — z-30 이고 z-50 이 아니다', () => {
    const markup = render('mid')

    expect(markup).toContain('z-30')
    expect(markup).not.toContain('z-50')
  })

  it('최대 단계에서는 버튼이 접기로 바뀐다 — 같은 버튼이 왕복한다', () => {
    expect(render('mid')).toContain(messages.map.expandSheet)
    expect(render('max')).toContain(messages.map.collapseSheet)
  })
})

describe('MapSheet — maxTopInset 은 max 단계의 상한만 바꾼다', () => {
  /**
   * `/places` 회귀 고정이다. 이 화면의 상단 컨트롤은 `absolute top-5` 라 `85dvh` 를
   * 2px 차로 비껴간다 — 기본값이 바뀌면 거기서 컨트롤이 덮인다.
   */
  it('주지 않으면 기본 상한 85dvh 다', () => {
    const markup = render('max')

    expect(markup).toContain('85dvh')
    expect(markup).not.toContain('100dvh')
  })

  it('주면 max 가 100dvh 에서 그 px 만큼 비운다 — 헤더가 정상 흐름인 화면이 쓴다', () => {
    const markup = render('max', { maxTopInset: 240 })

    expect(markup).toContain('100dvh')
    expect(markup).toContain('240px')
    expect(markup).not.toContain('85dvh')
  })

  /**
   * 회귀 고정 — 인셋 경로는 뷰포트에 선형이라 짧은 화면에서 max 가 mid 아래로 내려간다
   * (812×375 에서 375 − 240 = 135px < 45dvh = 169px). 그러면 `목록 더 보기` 가 시트를
   * 줄인다. `mid` 비율을 하한으로 걸어 두는 것으로 막는다.
   */
  it('inset 을 줘도 mid 비율 아래로는 안 내려간다 — max() 로 하한을 건다', () => {
    const markup = render('max', { maxTopInset: 240 })

    expect(markup).toContain('max(')
    expect(markup).toContain('45dvh')
  })

  it('mid 는 여전히 비율이다 — inset 은 max 에만 걸린다', () => {
    const markup = render('mid', { maxTopInset: 240 })

    expect(markup).toContain('45dvh')
    expect(markup).not.toContain('240px')
  })
})

describe('MapSheet — 모달이 아니다', () => {
  /**
   * `BottomSheet`(모달)와 갈리는 지점이다. 배경 덮개가 있거나 `aria-modal` 이 붙으면
   * 시트가 열려 있는 동안 지도를 만질 수 없다 — 아트보드 06 이 명시적으로 금지한다.
   */
  it('배경 덮개를 두지 않는다 — 시트가 열려도 지도 제스처가 살아 있어야 한다', () => {
    expect(render('mid')).not.toContain('overlay-backdrop')
  })

  it('aria-modal 을 붙이지 않는다 — 포커스를 가두면 지도로 돌아갈 수 없다', () => {
    expect(render('mid')).not.toContain('aria-modal')
  })

  it('시트에 이름을 준다 — 호출부가 준 이름을 그대로 쓴다', () => {
    expect(render('mid', { label: '목록' })).toContain('aria-label="목록"')
  })

  it('헤더와 목록을 모두 렌더한다 — 최소 단계에서도 개수는 남는다', () => {
    const markup = render('min')

    expect(markup).toContain('지도에 보이는 곳 8')
    expect(markup).toContain('목록 자리')
  })
})

/**
 * #901 **D2** — 지도 화면의 `max` 윗변이 **비율이 아니라 px** 이어야 하는 이유.
 *
 * 지도 위 플로팅 컨트롤의 바닥은 고정이다: 헤더(56 / md 64) + `top-5`(20) + 컨트롤(44)
 * = **120 / 128**. `85dvh` 는 812 기준 2px 여유로 튜닝됐지만 비율이라 **800 에서 딱 붙고
 * 640 에서 24px 덮었다**(실측).
 */
describe('MAP_TOP_CONTROLS_INSET — 지도 위 컨트롤을 비켜 간다 (#901 D2)', () => {
  /** 헤더 64(md) + top-5 20 + 컨트롤 44 */
  const CONTROLS_BOTTOM_MD = 128

  it('가장 낮은 폭(md)의 컨트롤 바닥보다 크다 — 여유가 남는다', () => {
    expect(MAP_TOP_CONTROLS_INSET).toBeGreaterThan(CONTROLS_BOTTOM_MD)
  })

  /** 너무 키우면 `max` 가 목록을 그만큼 잃는다 — 여유는 한 자릿수 십px 이면 족하다 */
  it('필요 이상으로 크지 않다 — 여유 16px 이내', () => {
    expect(MAP_TOP_CONTROLS_INSET - CONTROLS_BOTTOM_MD).toBeLessThanOrEqual(16)
  })

  it('그 값을 주면 max 가 비율이 아니라 px 로 선다', () => {
    const markup = render('max', { maxTopInset: MAP_TOP_CONTROLS_INSET })

    expect(markup).toContain('100dvh')
    expect(markup).toContain(`${String(MAP_TOP_CONTROLS_INSET)}px`)
    expect(markup).not.toContain('85dvh')
  })
})

/**
 * #901 **D3** — 잡을 곳이 그래버 한 줄(세로 16px)뿐이라 *"어딜 잡고 올려야 하는지"* 가
 * 읽히지 않았다. 이제 시트 머리 전체가 받고 **그 안의 컨트롤에서 시작한 제스처만** 빠진다.
 *
 * 포인터 핸들러는 마크업에 안 남으므로 **판정 함수**로 잠근다 — 실제 DOM 대신 `closest`
 * 만 흉내 낸 최소 객체를 넘긴다(이 저장소 테스트는 node 환경이라 레이아웃이 없다).
 */
describe('shouldStartSheetDrag — 무엇이 드래그를 시작하는가 (#901 D3)', () => {
  const at = (hit: string | null) => ({ closest: () => (hit === null ? null : hit) })

  it('컨트롤 밖(빈 자리·글자)에서는 드래그를 시작한다', () => {
    expect(shouldStartSheetDrag(at(null))).toBe(true)
  })

  it('버튼·링크·입력에서 시작한 제스처는 그 컨트롤의 것이다', () => {
    expect(shouldStartSheetDrag(at('button'))).toBe(false)
  })

  it('대상이 없으면 시작하지 않는다', () => {
    expect(shouldStartSheetDrag(null)).toBe(false)
  })
})

/**
 * 가로 스크롤 레일(필터 칩)이 머리 안에 있다. `touch-none` 으로 덮으면 **칩을 옆으로
 * 밀 수 없다** — 세로만 받고 가로는 브라우저에 넘긴다.
 */
describe('MapSheet — 머리의 터치 규칙 (#901 D3)', () => {
  it('머리는 touch-pan-x 다 — 가로 스크롤을 브라우저에 남긴다', () => {
    expect(render('mid')).toContain('touch-pan-x')
  })

  it('그래버 줄만 touch-none 이다 — 거기서는 가로로 끌어도 단계가 움직인다', () => {
    const markup = render('mid')

    expect(markup.match(/touch-none/g)).toHaveLength(1)
  })
})

/**
 * #901 **D1** — 단계 높이는 비율인데 머리는 고정 px 라, 360×640 에서 `/places` 의 `min`
 * 본문이 **0px**(목록 0행)이었다. 시트가 제 min-content 아래로 줄지 않게 하고, 목록이 그
 * min-content 에 한 줄 몫(48px)만 보태게 해서 막는다.
 *
 * 레이아웃이 없는 환경이라 **여는 태그의 클래스**로 잠근다. 마크업 전체에서 찾으면 다른
 * 요소의 클래스가 대신 초록을 낸다 — 시트는 `<section`, 목록은 children 바로 앞 `<div`.
 */
describe('MapSheet — 최소 단계에도 목록이 한 줄은 남는다 (#901 D1)', () => {
  // 부분 문자열로 찾으면 `min-h-min` 이 `min-h-minx` 에도 맞는다 — **클래스 토큰**으로 가른다
  const classesOf = (markup: string, pattern: RegExp) =>
    (/class="([^"]*)"/.exec(pattern.exec(markup)?.[0] ?? '')?.[1] ?? '').split(/\s+/)
  const sheetTag = (stop: SheetStop) => classesOf(render(stop), /<section[^>]*>/)
  const listTag = (stop: SheetStop) => classesOf(render(stop), /<div[^>]*>(?=<p>목록 자리)/)

  it('시트는 제 min-content 아래로 줄지 않는다 — 세 단계 모두', () => {
    for (const stop of SHEET_STOPS) expect(sheetTag(stop)).toContain('min-h-min')
  })

  it('목록은 min-content 에 한 줄 몫(48px)을 보탠다 — 0 으로 접히지 않는다', () => {
    const tag = listTag('min')

    expect(tag).toContain('min-h-12')
    expect(tag).not.toContain('min-h-0')
  })

  /**
   * 없으면 목록 **전체** 높이를 min-content 로 치는 엔진에서 시트가 목록 길이만큼 커진다 —
   * 하한이 "머리 + 한 줄" 이 아니라 "머리 + 목록 전부" 가 된다.
   */
  it('목록의 내용 높이는 하한에 들어가지 않는다 — contain-size', () => {
    expect(listTag('min')).toContain('contain-size')
  })

  it('목록은 여전히 스스로 스크롤한다', () => {
    expect(listTag('max')).toContain('overflow-y-auto')
  })
})
