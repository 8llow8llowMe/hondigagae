import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AboutView } from '@/features/about/about-view'
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
  */
  it('출처를 <ul> 로 둔다 — 한 문장으로 잇지 않는다', () => {
    expect(markup).toContain('<ul')
    expect(markup.match(/<li/g)?.length).toBe(messages.footer.sources.length)
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
