import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { InfoTip } from '@/components/info-tip'

const BASIS =
  '기상청 여름철 체감온도 산식으로 계산했습니다. 판정 시각의 기온과 상대습도로 습구온도를 구해 산출합니다.'

function render() {
  return renderToStaticMarkup(createElement(InfoTip, { label: '체감온도 근거', children: BASIS }))
}

/*
  #313 — 이 저장소의 테스트는 jsdom 없이 `renderToStaticMarkup` 문자열을 본다
  (`docs/testing-guide.md`). 즉 **첫 렌더의 계약**만 고정할 수 있다. hover / focus / click 로
  열리는지, Esc·바깥 클릭으로 닫히는지는 브라우저 실측으로 확인했다 (PR 검증 내역).

  `useMediaQuery` 의 서버 스냅샷이 `false` 라 이 렌더는 **좁은 화면 갈래**다.
*/
describe('InfoTip', () => {
  it('아이콘만 든 버튼에 이름을 준다', () => {
    expect(render()).toContain('aria-label="체감온도 근거"')
  })

  /*
    **`title` 을 쓰지 않는다.** 모바일에서 안 뜨고 스크린리더 지원이 제각각이며
    지연 시간을 우리가 정하지 못한다.
  */
  it('title 속성을 쓰지 않는다', () => {
    expect(render()).not.toContain('title=')
  })

  it('닫힌 상태로 시작한다 — 내용이 첫 렌더에 서지 않는다', () => {
    const markup = render()

    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('기상청 여름철 체감온도 산식')
  })

  /* 44px 터치 영역 (DESIGN.md §7). `-m-3` 이 그만큼을 레이아웃에서 되돌린다 */
  it('44px 터치 영역을 지키고 그만큼을 레이아웃에서 되돌린다', () => {
    const markup = render()

    expect(markup).toContain('size-11')
    expect(markup).toContain('-m-3')
  })

  /* 좁은 화면은 팝오버가 아니라 시트다 — 100자 넘는 문장이 390px 말풍선에 안 들어간다 */
  it('좁은 화면 갈래에서는 팝오버를 만들지 않는다', () => {
    expect(render()).not.toContain('role="tooltip"')
  })
})
