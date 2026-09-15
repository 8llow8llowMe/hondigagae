import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Reveal, REVEAL_HIDDEN_CLASS } from '@/features/about/reveal'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 스크롤 등장 래퍼 (#635, 명세 §6-4 1단).
 *
 * **처음 렌더는 보이는 상태다.** 숨김은 마운트 뒤 화면 밖 요소에만 건다 — 검색 봇 · JS 실패 ·
 * 느린 기기에서 빈 화면이 생기지 않는다. 그래서 정적 마크업에는 숨김 클래스가 없어야 한다.
 */
describe('Reveal — 정적 렌더', () => {
  /*
    `children` 을 세 번째 인자가 아니라 props 로 넘긴다 — 이 저장소의 다른 테스트와 같다
    (`metric.test.ts` · `ai-plan-details-disclosure.test.ts`). `children` 이 **필수** prop
    인 컴포넌트는 `createElement(C, props, child)` 형태가 타입체크에서 깨진다: 가변 children
    오버로드가 두 번째 인자만으로 props 를 만족시키라고 요구해 `children` 누락으로 본다.
  */
  const markup = renderToStaticMarkup(
    createElement(Reveal, { delay: 60, children: createElement('p', null, '내용') }),
  )

  it('자식을 그대로 그린다', () => {
    expect(markup).toContain('<p>내용</p>')
  })

  it('숨김 클래스가 없다 — JS 없이도 보인다', () => {
    for (const cls of REVEAL_HIDDEN_CLASS.split(' ')) expect(markup).not.toContain(cls)
  })

  it('지연은 transition-delay 인라인 값이다 — 형제 60ms 간격', () => {
    expect(markup).toContain('transition-delay:60ms')
  })

  it('전환 길이는 §8 변형 값 200ms 다', () => {
    expect(markup).toContain('duration-200')
    expect(markup).toContain('ease-out')
  })
})

describe('useRevealOnce — 규칙', () => {
  const source = readSourceWithoutComments('src/features/about/use-reveal-once.ts')

  it('IntersectionObserver 를 cleanup 에서 disconnect 한다', () => {
    expect(source).toContain('observer.disconnect()')
  })

  it('IntersectionObserver 가 없는 환경에서는 손대지 않는다', () => {
    expect(source).toContain("typeof IntersectionObserver === 'undefined'")
  })
})
