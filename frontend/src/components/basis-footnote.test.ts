import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { BasisFootnote } from '@/components/basis-footnote'

function render(humidity: number | null, providerName: string | null) {
  return renderToStaticMarkup(createElement(BasisFootnote, { humidity, providerName }))
}

/*
  #317 — 응답에 있는데 자리를 못 정한 채 남아 있던 필드 둘이다. 근거를 여는 자리
  (홈 `InfoTip` · 장소 상세 서랍) 안에서만 살고, 상시 노출 줄을 새로 만들지 않는다.
*/
describe('BasisFootnote', () => {
  it('둘 다 있으면 한 줄로 잇는다', () => {
    expect(render(60, '기상청 단기예보')).toContain('계산에 쓴 상대습도 60% · 출처 기상청 단기예보')
  })

  /* 출처가 없어도 근거 문장은 성립한다 — 어색해지지 않게 그 조각만 뺀다 */
  it('출처가 없으면 습도만 남는다', () => {
    const markup = render(60, null)

    expect(markup).toContain('계산에 쓴 상대습도 60%')
    expect(markup).not.toContain('·')
    expect(markup).not.toContain('출처')
  })

  it('습도가 없으면 출처만 남는다', () => {
    const markup = render(null, '기상청 단기예보')

    expect(markup).toContain('출처 기상청 단기예보')
    expect(markup).not.toContain('상대습도')
  })

  /* 빈 줄을 남기지 않는다 — 각주 자체가 없다 */
  it('둘 다 없으면 아무것도 그리지 않는다', () => {
    expect(render(null, null)).toBe('')
  })

  /* 서버가 빈 문자열을 줄 수도 있다. `출처 ` 로 끝나는 줄을 만들지 않는다 */
  it('출처가 빈 문자열이면 없는 것으로 본다', () => {
    expect(render(null, '')).toBe('')
  })

  /* 0% 는 값이다. `null` 과 같이 취급하면 건조한 날의 입력이 사라진다 */
  it('습도 0 을 값으로 취급한다', () => {
    expect(render(0, null)).toContain('계산에 쓴 상대습도 0%')
  })
})
