import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { MapSheet, type SheetStop } from '@/components/map-sheet'
import { messages } from '@/lib/messages'

// 이 파일은 화면과 무관한 범용 동작(단계 전환·모달 아님)만 검증한다 —
// 이름 자체는 호출부마다 다르므로(`src/components/map-sheet.test.ts`) 임의 값을 쓴다.
function render(stop: SheetStop, label = '목록') {
  return renderToStaticMarkup(
    createElement(MapSheet, {
      label,
      stop,
      onStopChange: () => undefined,
      header: createElement('p', null, '지도에 보이는 곳 8'),
      children: createElement('p', null, '목록 자리'),
    }),
  )
}

describe('MapSheet — 단계가 화면을 바꾼다', () => {
  it('단계마다 높이가 다르고 위로 갈수록 커진다', () => {
    const height = (markup: string) => Number(/calc\((\d+(?:\.\d+)?)dvh/.exec(markup)?.[1] ?? 0)

    expect(height(render('min'))).toBeLessThan(height(render('mid')))
    expect(height(render('mid'))).toBeLessThan(height(render('max')))
  })

  it('최소 단계에서만 탭바 위에 앉는다 — 그 위에서는 탭바 자리를 쓴다', () => {
    expect(render('min')).toContain('map-sheet-above-tabbar')
    expect(render('mid')).not.toContain('map-sheet-above-tabbar')
    expect(render('max')).not.toContain('map-sheet-above-tabbar')
  })

  it('최대 단계에서는 버튼이 접기로 바뀐다 — 같은 버튼이 왕복한다', () => {
    expect(render('mid')).toContain(messages.map.expandSheet)
    expect(render('max')).toContain(messages.map.collapseSheet)
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
    expect(render('mid', '목록')).toContain('aria-label="목록"')
  })

  it('헤더와 목록을 모두 렌더한다 — 최소 단계에서도 개수는 남는다', () => {
    const markup = render('min')

    expect(markup).toContain('지도에 보이는 곳 8')
    expect(markup).toContain('목록 자리')
  })
})
