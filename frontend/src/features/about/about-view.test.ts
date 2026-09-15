import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SCALE_SPECIMEN } from '@/features/about/about-specimen-data'
import { AboutView } from '@/features/about/about-view'
import { REVEAL_HIDDEN_CLASS } from '@/features/about/reveal'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 서비스 소개 — `/about` (#611 → #635).
 *
 * **서버 컴포넌트라 통째로 렌더된다.** 안의 클라이언트 예시들은 초기 상태(끝 상태)로 그려진다
 * (`testing-guide.md` §1).
 */
const markup = renderToStaticMarkup(createElement(AboutView))
const hrefs = [...markup.matchAll(/href="([^"]*)"/g)].map((match) => match[1])

/**
 * 속성값을 걷고 **화면에 읽히는 글자만** 남긴다.
 *
 * 숫자를 마크업 전체에서 세면 **SVG 좌표에 걸린다** — 히어로 락업의 `Wordmark` 글리프
 * 외곽선에 `H315.75` 가 두 번 들어 있어서, 규모 숫자 `315` 가 3회로 세어졌다. 그것은 같은
 * 사실을 두 번 말한 것이 아니라 글자 모양의 좌표다.
 *
 * React 는 텍스트 노드의 `"` 도 이스케이프하므로 따옴표 쌍은 전부 속성값이다.
 */
const text = markup.replace(/"[^"]*"/g, '')

describe('AboutView — 출처 표기 (#611 의 존재 이유를 잃지 않는다)', () => {
  it('데이터 출처를 남긴다 — 푸터와 같은 다섯 곳', () => {
    expect(markup).toContain(messages.footer.sourcesLabel)
    for (const source of messages.footer.sources) expect(markup).toContain(source)
  })

  it('공모전 표기와 한계 안내를 남긴다', () => {
    expect(markup).toContain(messages.footer.contest)
    expect(markup).toContain(messages.footer.disclaimer)
  })

  it('출처·면책·공모전 문구를 messages.footer 에서 읽는다 — 다시 적지 않는다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')
    expect(source).toContain('messages.footer.sources')
    expect(source).toContain('messages.footer.disclaimer')
    expect(source).toContain('messages.footer.contest')
    for (const literal of messages.footer.sources) expect(source).not.toContain(`'${literal}'`)
  })
})

describe('AboutView — 8절 (#635)', () => {
  it('h1 이 보인다 — 히어로가 화면 제목이다', () => {
    const h1 = markup.match(/<h1[^>]*>/)?.[0] ?? ''
    expect(h1).not.toBe('')
    expect(h1).not.toContain('sr-only')
    expect(markup).toContain(messages.about.hero.heading)
  })

  it('질문 순서로 h2 가 선다', () => {
    const order = [
      messages.about.q1.heading,
      messages.about.q2.heading,
      messages.about.q3.heading,
      messages.about.q4.heading,
      messages.about.data.heading,
    ].map((heading) => markup.indexOf(heading))
    expect(order.every((position) => position > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('링크는 전부 실제 라우트다 — 갈 곳 있는 링크만', () => {
    expect(new Set(hrefs)).toEqual(
      new Set(['/', '/places', '/ai-plans/new', '/emergency', '/pets/new']),
    )
  })

  it('최종값이 처음부터 DOM 에 있다', () => {
    for (const text of ['>29<', '>56.0<', '>31<', messages.about.specimen.verdictGrade]) {
      expect(markup).toContain(text)
    }
    expect(markup).toContain(messages.about.specimen.suitabilityGrade)
  })

  it('정적 마크업에 숨김 클래스가 없다 — JS 없이도 보인다', () => {
    for (const cls of [...REVEAL_HIDDEN_CLASS.split(' '), 'scale-y-0']) {
      expect(markup).not.toContain(cls)
    }
  })

  it('규모 숫자는 타일 한 곳에만 있다 — 같은 사실을 두 번 말하지 않는다', () => {
    expect(text.match(new RegExp(String(SCALE_SPECIMEN.places), 'g'))?.length).toBe(1)
    expect(text.match(new RegExp(String(SCALE_SPECIMEN.emergency), 'g'))?.length).toBe(1)
    expect(markup).toContain(messages.about.data.scaleNote)
  })

  it('등급 색은 예시 자리에만 — 절 제목·아이콘에 metric 이 없다', () => {
    const h2s = markup.match(/<h2[^>]*>/g) ?? []
    for (const h2 of h2s) expect(h2).not.toContain('metric-')
  })

  it('그림자를 쓰지 않는다', () => {
    expect(markup).not.toMatch(/\bshadow-(md|lg)\b/)
  })
})

describe('AboutView — 자리', () => {
  it('카드 안쪽 인셋을 INSET_CLASS.card 로 참조한다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')
    expect(source).toContain('INSET_CLASS.card')
    expect(markup).toContain(INSET_CLASS.card)
  })

  it('/about 을 보호 경로로 두지 않는다', () => {
    expect(readSourceWithoutComments('proxy.ts')).not.toContain('/about')
  })

  it('밴드 배경은 intro 토큰과 brand-700 이다 — brand-50/100 을 되살리지 않는다', () => {
    expect(markup).toContain('bg-intro-band')
    expect(markup).toContain('bg-brand-700')
    expect(markup).not.toMatch(/\bbg-brand-(50|100)\b/)
  })
})

describe('AboutView — 모바일의 약관 도달 경로', () => {
  /*
    **이 단언이 지키는 것은 링크가 아니라 접근성이다** (#610). 푸터는 768 미만에서 감춰지고
    (`app/globals.css`), 마이페이지는 로그인이 필요하며, `(auth)` 그룹에는 푸터가 없다.
    이 세 가지가 동시에 참이라 **이 화면이 없으면 로그인하지 않은 모바일 방문자는
    가입 전에 약관을 읽을 수단이 없다.** 약관은 가입 전에 읽는 문서다.

    #635 에서 화면이 8절 소개 페이지로 다시 짜였다. **그때 이 절이 조용히 빠지는 회귀를
    이 테스트가 잡는다.**
  */
  it('약관·처리방침으로 가는 링크를 둔다', () => {
    expect(markup).toContain(messages.about.legal.title)

    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
      expect(markup).toContain(link.label)
    }
  })

  /*
    푸터·마이페이지와 **같은 목록**을 읽는다. 여기서 문자열을 다시 지으면 같은 문서가
    화면마다 다른 이름으로 보인다 — 출처 문구를 `messages.footer` 에서 읽는 것과 같은 축이다.
  */
  it('링크 라벨을 다시 짓지 않고 LEGAL_LINKS 를 읽는다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')

    expect(source).toContain('LEGAL_LINKS.map')
    expect(source).not.toContain('이용약관')
    expect(source).not.toContain('개인정보 처리방침')
  })
})
