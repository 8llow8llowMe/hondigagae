import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Reveal, REVEAL_HIDDEN_CLASS } from '@/features/about/reveal'
import { readSourceWithoutComments } from '@/test/source'
import { readGlobalsCss } from '@/test/tokens'

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

  it('보이는 상태에서는 transition 을 끄지 않는다 — 정적 마크업에 transition-none 이 없다', () => {
    expect(markup).not.toContain('transition-none')
  })
})

/**
 * `armed` 동안 transition 을 끄는 소비자 계약 (검토 1차 Important).
 *
 * 요소는 이미 `transition duration-200 ease-out` 을 달고 **보이는 채로** 칠해져 있다. 그
 * 상태에서 숨김 클래스를 붙이면 그 붙임 자체가 전환 대상이 되어, `armed` 프레임은 200ms
 * 페이드아웃의 **시작점**만 그린다. 다음 프레임에 클래스를 떼면 눈에 보이는 재생이 없다.
 *
 * 그래서 `armed` 동안에는 transition 을 꺼 숨김 상태를 **즉시** 칠하고, `revealed` 에서
 * transition 을 켠다. `Reveal` 은 `playIfVisible: false` 라 이 경로를 타지 않지만, Task 4~6
 * 의 표본이 그대로 베낄 계약이므로 여기서 형태를 잡는다.
 */
describe('Reveal — armed 계약', () => {
  const source = readSourceWithoutComments('src/features/about/reveal.tsx')

  it('소스에 armed 용 transition-none 이 있다', () => {
    expect(source).toContain('transition-none')
  })

  it('숨김 클래스와 transition-none 이 같은 분기에 있다', () => {
    expect(source).toContain(`cn('transition-none', REVEAL_HIDDEN_CLASS)`)
  })
})

/**
 * 훅은 소스 문자열로만 본다 — node 환경 vitest 에는 `IntersectionObserver` 도 rAF 도
 * 레이아웃도 없어 위상 전이를 렌더로 재현할 수 없다 (`docs/testing-guide.md` §1). 그래서
 * 아래 이름은 **소스에 그 호출/가드가 있다**까지만 말한다. 실제 동작은 브라우저 계측 몫이다.
 */
describe('useRevealOnce — 소스 규칙', () => {
  const source = readSourceWithoutComments('src/features/about/use-reveal-once.ts')

  it('소스에 observer.disconnect() 호출이 있다 (cleanup 동작은 브라우저 계측 몫)', () => {
    expect(source).toContain('observer.disconnect()')
  })

  it('IntersectionObserver 부재 가드가 소스에 있다', () => {
    expect(source).toContain("typeof IntersectionObserver === 'undefined'")
  })

  it('보이는데 재생하지 않는 경로에서 armed 를 idle 로 되돌린다', () => {
    expect(source).toContain("setPhase('idle')")
  })
})

/**
 * 감속 설정은 전역 규칙 하나가 잡는다 (검토 최종 Important 1).
 *
 * `transition-duration` 만 0.01ms 로 덮으면 **지연은 그대로 남는다** — 곡선의 추천 구간 면과
 * 봉우리 라벨(800ms), 막대의 색 전환(820ms)이 인라인 `transitionDelay` 를 쓰기 때문에,
 * 감속을 켠 사용자에게도 끝 상태가 0.8초 뒤에 나타난다. 지연까지 꺼야 "즉시 끝 상태"가 된다.
 */
describe('prefers-reduced-motion — 지연까지 끈다', () => {
  const globals = readGlobalsCss()

  it('감속 블록이 transition-delay 를 0s 로 덮는다', () => {
    expect(globals).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-delay:\s*0s !important/,
    )
  })
})
