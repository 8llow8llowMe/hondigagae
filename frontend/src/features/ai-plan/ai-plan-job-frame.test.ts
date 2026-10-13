import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanJobCondition } from '@/features/ai-plan/ai-plan-job-frame'

/**
 * 조건 블록의 요청 문구 줄 (#1431 · #1487).
 *
 * 요청 문구는 사용자가 쓴 글이다. 문구 템플릿에 문자열로 치환하면 값 안의 `$&` · `$'` ·
 * `$$` 가 치환 패턴으로 해석돼 `요청 “가격 {note} 이하”` 처럼 찍혔다(#1487).
 */
function render(note: string) {
  return renderToStaticMarkup(
    createElement(AiPlanJobCondition, {
      inset: 'main',
      label: '만드는 조건',
      summary: '제주시 · 2박 3일',
      note,
    }),
  )
}

describe('AiPlanJobCondition — 요청 문구', () => {
  it('값 안의 $& 를 치환 패턴으로 해석하지 않는다', () => {
    // `&` 는 마크업에서 `&amp;` 로 이스케이프된다
    expect(render('가격 $& 이하')).toContain('요청 “가격 $&amp; 이하”')
  })

  it("값 안의 $' · $` · $$ 를 글자 그대로 보인다", () => {
    const markup = render('뒤 $` 앞 $$ 끝')

    expect(markup).toContain('요청 “뒤 $` 앞 $$ 끝”')
  })

  it("값 안의 $' 가 템플릿의 뒷부분을 끌어오지 않는다", () => {
    // `'` 는 마크업에서 `&#x27;` 로 이스케이프된다
    expect(render("끝 $' 표시")).toContain('요청 “끝 $&#x27; 표시”')
  })
})
