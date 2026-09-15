import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AboutView } from '@/features/about/about-view'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 서비스 소개 — `/about`.
 *
 * **상태가 없는 서버 컴포넌트라 통째로 렌더된다** (`testing-guide.md` §1).
 */
const markup = renderToStaticMarkup(createElement(AboutView))

describe('AboutView — 모바일에서 푸터가 잃은 것을 여기서 되찾는다', () => {
  /*
    **이 화면의 존재 이유다.** 768 미만에는 푸터가 없으므로(`site-footer.test.ts`) 출처가
    여기 없으면 모바일에서 출처가 통째로 사라진다 — 푸터 테스트와 **같은 항목**을 센다.
  */
  it('데이터 출처를 남긴다 — 푸터와 같은 다섯 곳', () => {
    expect(markup).toContain(messages.footer.sourcesLabel)

    for (const source of messages.footer.sources) {
      expect(markup).toContain(source)
    }
  })

  it('공모전 표기와 한계 안내를 남긴다', () => {
    expect(markup).toContain(messages.footer.contest)
    expect(markup).toContain(messages.footer.disclaimer)
  })

  /*
    쉼표로 이은 한 문장으로 쓰면 스크린리더가 기관 이름 다섯 개를 한 덩어리로 읽는다 —
    푸터와 같은 이유로 `<ul>` 이다.

    **`<li>` 개수는 출처 카드 구간만 센다.** 화면 전체로 세면 약관 카드(#610)의
    `SurfaceList` 도 `<li>` 를 그려 총합이 갈린다 — 두 목록은 서로 다른 것을 센다.
  */
  it('출처를 <ul> 로 둔다 — 한 문장으로 잇지 않는다', () => {
    expect(markup).toContain('<ul')

    const sourcesSection = markup.slice(
      markup.indexOf('about-sources-heading'),
      markup.indexOf('about-notice-heading'),
    )
    expect(sourcesSection.match(/<li/g)?.length).toBe(messages.footer.sources.length)
  })

  /*
    **문구를 다시 적으면 두 곳이 갈린다.** 한쪽만 고쳐졌을 때 같은 데이터의 출처가
    데스크톱(푸터)과 모바일(이 화면)에서 다르게 보인다.
  */
  it('출처·면책·공모전 문구를 messages.footer 에서 읽는다 — 다시 적지 않는다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')

    expect(source).toContain('messages.footer.sources')
    expect(source).toContain('messages.footer.disclaimer')
    expect(source).toContain('messages.footer.contest')

    for (const literal of messages.footer.sources) {
      expect(source).not.toContain(`'${literal}'`)
    }
  })
})

describe('AboutView — 자리', () => {
  /* 보이는 제목은 첫 카드의 `h2` 다 — `h1` 은 화면에 두지 않는다 (§0) */
  it('h1 을 sr-only 로 두고 카드가 제목을 그린다', () => {
    expect(markup).toContain('sr-only')
    expect(markup).toContain(messages.about.title)
    expect(markup).toContain('<h2')
  })

  /* 왼쪽 기준선을 지킨다 — L0 바닥 위 카드 안쪽은 `card` 다 (`lib/ui/inset.ts`) */
  it('카드 안쪽 인셋을 INSET_CLASS.card 로 참조한다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')

    expect(source).toContain('INSET_CLASS.card')
    expect(markup).toContain(INSET_CLASS.card)
  })

  /*
    **보호 라우트가 아니다.** 출처 표기를 로그인 뒤에 두면 표기하지 않은 것과 같다 —
    이 화면이 생긴 이유 자체가 비로그인 모바일 방문자다.
  */
  it('/about 을 보호 경로로 두지 않는다', () => {
    expect(readSourceWithoutComments('proxy.ts')).not.toContain('/about')
  })
})

describe('AboutView — 모바일의 약관 도달 경로', () => {
  /*
    **이 단언이 지키는 것은 링크가 아니라 접근성이다.** 푸터는 768 미만에서 감춰지고
    (`app/globals.css`), 마이페이지는 로그인이 필요하며, `(auth)` 그룹에는 푸터가 없다.
    이 세 가지가 동시에 참이라 **이 화면이 없으면 로그인하지 않은 모바일 방문자는
    가입 전에 약관을 읽을 수단이 없다.** 약관은 가입 전에 읽는 문서다.
  */
  it('약관·처리방침으로 가는 링크를 둔다', () => {
    expect(markup).toContain(messages.about.legalTitle)

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
