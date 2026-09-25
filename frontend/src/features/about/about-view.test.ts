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
/**
 * 링크(`<a>`)의 `href` 만 — React 19 가 즉시 로드 이미지(히어로 캐릭터)에 붙이는
 * `<link rel="preload" href>` 는 링크가 아니다(실제 HTML 에서는 `head` 로 올라간다).
 */
const hrefs = [...markup.matchAll(/<a [^>]*href="([^"]*)"/g)].map((match) => match[1])

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
    const view = readSourceWithoutComments('src/features/about/about-view.tsx')
    // 출처 목록은 #940 부터 데이터 절의 규모 · 출처 컴포넌트가 그린다
    const scale = readSourceWithoutComments('src/features/about/data-scale.tsx')
    expect(scale).toContain('messages.footer.sources')
    expect(scale).toContain('messages.footer.sourcesLabel')
    expect(view).toContain('messages.footer.disclaimer')
    expect(view).toContain('messages.footer.contest')
    for (const literal of messages.footer.sources) {
      expect(view).not.toContain(`'${literal}'`)
      expect(scale).not.toContain(`'${literal}'`)
    }
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
    // `/terms` · `/privacy` 는 약관 절이 `LEGAL_LINKS` 에서 읽는다 (#610)
    const routes = hrefs.filter((href) => href !== undefined && !href.startsWith('#'))
    expect(new Set(routes)).toEqual(
      new Set([
        '/',
        '/places',
        '/ai-plans/new',
        '/emergency',
        '/pets/new',
        ...LEGAL_LINKS.map((link) => link.href),
      ]),
    )
  })

  it('앵커 링크는 이 화면에 실제로 있는 절을 가리킨다 — 절 내비 · 스크롤 힌트 (#915)', () => {
    const anchors = hrefs.filter((href): href is string => href?.startsWith('#') === true)
    expect(anchors.length).toBeGreaterThan(0)
    for (const anchor of anchors) {
      expect(markup, anchor).toMatch(new RegExp(`<section id="${anchor.slice(1)}"`))
    }
  })

  it('최종값이 처음부터 DOM 에 있다', () => {
    for (const fragment of ['>29<', '>56.0<', '>31<', messages.about.specimen.verdictGrade]) {
      expect(markup).toContain(fragment)
    }
    expect(markup).toContain(messages.about.specimen.suitabilityGrade)
  })

  /*
    **예시는 실화면을 보여 주는 것이 일이다** (#652 · 등급배지-축라벨-세부명세 D8-3).
    예전에는 여기만 `적합도 높음` 이라 소개 페이지가 실제로 없는 화면을 보여 줬다 —
    실제 서버 `name` 은 `여행 적합` 이고 축은 배지가 붙인다.
  */
  it('적합도 예시가 실화면과 같은 어휘를 쓴다', () => {
    const axis = messages.common.metricAxisSuitability
    const badge = markup.slice(
      markup.indexOf(`>${axis} </span>`),
      markup.indexOf(`>${axis} </span>`) + 120,
    )

    expect(markup).toContain(`>${axis} </span>`)
    expect(badge).toContain(`</span>${messages.about.specimen.suitabilityGrade}</span>`)
    /* 축 라벨이 문구 상수로 되돌아가면 배지가 `적합도 적합도 …` 가 된다 */
    expect(messages.about.specimen.suitabilityGrade).not.toContain(axis)
  })

  it('정적 마크업에 숨김 클래스가 없다 — JS 없이도 보인다', () => {
    for (const cls of [...REVEAL_HIDDEN_CLASS.split(' '), 'scale-y-0']) {
      expect(markup).not.toContain(cls)
    }
  })

  it('규모 숫자는 타일 한 곳에만 있다 — 같은 사실을 두 번 말하지 않는다', () => {
    /*
      **글자 자리(`>숫자<`)만 센다.** 마크업 전체에서 세면 SVG 좌표에 걸린다 — 히어로 락업
      `Wordmark` 의 글리프 외곽선에 `H315.75` 가 두 번 들어 있어 `315` 가 3회로 세어졌다.
      그것은 같은 사실을 두 번 말한 것이 아니라 글자 모양의 좌표다.

      타일은 `>315<span …>곳</span>` 으로 그리므로 `>315<` 가 정확히 한 번 나온다.
    */
    /*
      **스크린리더용 최종값(`sr-only`)은 빼고 센다** (#915). 규모 숫자가 카운트업하면서
      판정 카드와 같은 계약(최종값 `sr-only` + 세는 중간값 `aria-hidden`)을 따르게 됐다 —
      같은 값이 두 노드에 있지만 눈과 귀에 각각 한 번이라 같은 사실을 두 번 말한 것이 아니다.
    */
    const visible = markup.replace(/<span class="sr-only">[^<]*<\/span>/g, '')
    const textOccurrences = (value: number) => visible.match(new RegExp(`>${value}<`, 'g'))?.length
    const spokenOccurrences = (value: number) =>
      markup.match(new RegExp(`<span class="sr-only">${value}</span>`, 'g'))?.length

    expect(textOccurrences(SCALE_SPECIMEN.places)).toBe(1)
    expect(textOccurrences(SCALE_SPECIMEN.emergency)).toBe(1)
    expect(spokenOccurrences(SCALE_SPECIMEN.places)).toBe(1)
    expect(spokenOccurrences(SCALE_SPECIMEN.emergency)).toBe(1)
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

describe('AboutView — 스크롤 무대 (#914)', () => {
  /** 절 하나의 마크업 — `aria-labelledby` 로 여는 section 부터 다음 section 전까지 */
  const section = (headingId: string) => {
    const start = markup.indexOf(`aria-labelledby="${headingId}"`)
    const next = markup.indexOf('<section', start + 1)
    return markup.slice(start, next === -1 ? undefined : next)
  }
  const stageOpen = (html: string) => html.match(/<div class="about-stage[ "][^>]*>/g) ?? []

  it('질문 1 · 질문 2 · 위급 절이 무대다 — 정확히 세 개', () => {
    expect(stageOpen(markup)).toHaveLength(3)
    for (const id of ['about-q1-heading', 'about-q2-heading', 'about-q4-heading']) {
      expect(stageOpen(section(id)), id).toHaveLength(1)
    }
  })

  it('질문 3 · 데이터 절은 무대가 아니다', () => {
    for (const id of ['about-q3-heading', 'about-data-heading']) {
      expect(stageOpen(section(id)), id).toHaveLength(0)
    }
  })

  it('무대의 항목 수가 절의 항목 문장 수와 같다', () => {
    const cases = [
      ['about-q1-heading', messages.about.q1.points],
      ['about-q2-heading', messages.about.q2.points],
      ['about-q4-heading', messages.about.q4.points],
    ] as const
    for (const [id, points] of cases) {
      const items = section(id).match(/<li class="[^"]*about-stage-point[^"]*"/g) ?? []
      expect(items, id).toHaveLength(points.length)
      // 마크업은 작은따옴표를 `&#x27;` 로 이스케이프한다
      for (const point of points) expect(section(id)).toContain(point.replaceAll("'", '&#x27;'))
    }
  })

  it('정적 렌더의 무대는 마지막 단계다 — 플래그가 항목 수만큼 있고 is-live 가 없다', () => {
    const cases = [
      ['about-q1-heading', messages.about.q1.points.length],
      ['about-q2-heading', messages.about.q2.points.length],
      ['about-q4-heading', messages.about.q4.points.length],
    ] as const
    for (const [id, count] of cases) {
      const open = stageOpen(section(id))[0] ?? ''
      expect(open, id).toContain(`is-step-${count}`)
      expect(open, id).toContain(`is-current-${count}`)
      expect(open, id).not.toContain('is-live')
    }
  })

  it('무대 안 예시는 Reveal 로 감싸지 않는다 — 두 모션이 겹치면 단계 0 이 두 번 숨는다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')
    for (const specimen of ['PlacesSpecimen', 'GoldenCurveSpecimen', 'EmergencySpecimen']) {
      expect(source).toContain(`visual={<${specimen} />}`)
      expect(source).not.toMatch(new RegExp(`<Reveal[^>]*>\\s*<${specimen}`))
    }
  })
})

/**
 * 절 하나 — 다음 **절 밴드**(`<section id="about-…`) 전까지. 그냥 `<section` 으로 끊으면 예시 카드
 * (`Surface` 도 `section` 이다)에서 잘린다.
 */
const band = (headingId: string) => {
  const start = markup.indexOf(`aria-labelledby="${headingId}"`)
  const next = markup.indexOf('<section id="about-', start + 1)
  return markup.slice(start, next === -1 ? undefined : next)
}

describe('AboutView — 무대 항목 · 맥락 줄 · 바로가기 (#940)', () => {
  const section = band
  const staged = [
    ['about-q1-heading', messages.about.q1],
    ['about-q2-heading', messages.about.q2],
    ['about-q4-heading', messages.about.q4],
  ] as const

  it('항목 문장은 행 제목 등급이다 — 14px · 400 이 58vh 칸 안에서 각주처럼 읽혔다', () => {
    const texts = markup.match(/<p class="about-stage-text [^"]*"/g) ?? []
    expect(texts.length).toBe(10)
    for (const text of texts) {
      const cls = text.split('"')[1]?.split(' ') ?? []
      expect(cls).toEqual(
        expect.arrayContaining(['text-body-1', 'lg:text-title-2', 'font-semibold']),
      )
      expect(cls).not.toContain('text-body-2')
    }
  })

  it('번호 칸의 기본 모양은 켜진 모양(채움)이다 — 정적 렌더 · 감속 모션이 끝 상태를 본다', () => {
    const marks = markup.match(/<span aria-hidden="true" class="about-stage-mark [^"]*"/g) ?? []
    expect(marks.length).toBe(10)
    for (const mark of marks) {
      const cls = mark.split('class="')[1]?.replace('"', '').split(' ') ?? []
      expect(cls).toEqual(expect.arrayContaining(['bg-brand-700', 'text-fg-inverse']))
      // body-2 의 weight 는 400 · 600 뿐이다 (DESIGN §3-1)
      expect(cls).toContain('font-semibold')
      expect(cls).not.toContain('font-bold')
    }
  })

  it('번호 칸이 항목 번호를 적는다 — 오른쪽 예시의 몇 번째 상태인지 (목록은 ol)', () => {
    for (const [id, copy] of staged) {
      const marks = [...section(id).matchAll(/class="about-stage-mark [^"]*">(\d+)</g)].map(
        (match) => Number(match[1]),
      )
      expect(marks, id).toEqual(copy.points.map((_, index) => index + 1))
      expect(section(id), id).toMatch(
        /<ol class="mt-5 grid gap-3"><li class="[^"]*about-stage-point/,
      )
    }
  })

  it('맥락 줄이 무대마다 하나다 — 표지어 · 제목은 aria-hidden, 바로가기는 절 링크', () => {
    expect(markup.match(/<div class="about-stage-context">/g)).toHaveLength(staged.length)
    for (const [id, copy] of staged) {
      const contexts = [
        ...section(id).matchAll(/<div class="about-stage-context">([\s\S]*?)<\/a><\/div>/g),
      ]
      expect(contexts, id).toHaveLength(1)
      const html = contexts[0]?.[1] ?? ''
      expect(html).toMatch(/<p aria-hidden="true" class="about-stage-context-title /)
      expect(html).toContain(`<span class="text-link">${copy.kicker}</span> · ${copy.heading}`)
      expect(html).toContain(copy.link)
    }
  })

  it('무대 절의 항목 아래 바로가기는 1024 이상에서 숨는다 — 같은 링크가 두 번 읽히지 않는다', () => {
    for (const [id, copy] of staged) {
      const links = [...section(id).matchAll(/<a class="([^"]*)" href="[^"]*">([^<]*)/g)].filter(
        (match) => match[2]?.trim() === copy.link,
      )
      expect(links, id).toHaveLength(2)
      const bottom = links.filter((match) => match[1]?.split(' ').includes('lg:hidden'))
      expect(bottom, id).toHaveLength(1)
    }
  })

  it('바로가기는 문장과 같은 등급(text-body-1)이다 — 설명보다 작지 않다', () => {
    const links = markup.match(/<a class="text-body-1 text-link [^"]*min-h-11[^"]*"/g) ?? []
    // 무대 셋 × 2(맥락 줄 · 항목 아래) + 질문 3 하나
    expect(links.length).toBe(7)
    expect(markup).not.toMatch(/<a class="text-body-2 text-link /)
  })

  it('질문 2 는 캐릭터 자리(about-pose-room)가 예시 덩어리에 붙는다 — 카피 열 꼬리는 없다', () => {
    expect(section('about-q2-heading')).toMatch(/<div class="about-stage-frame about-pose-room">/)
    expect(markup).not.toContain('about-pose-tail')
  })
})

describe('AboutView — 질문 3 목록 + 예시 하나 (#940)', () => {
  const q3 = band('about-q3-heading')
  /* 이 절의 탭 목록만 — AI 일정 예시가 자기 일자 탭 목록(`PlanSpecimen`)을 따로 갖는다 */
  const listStart = q3.indexOf(`role="tablist" aria-label="${messages.about.q3.tablistLabel}"`)
  const tablist = q3.slice(listStart, q3.indexOf('</button></div>', listStart) + '</button>'.length)
  const panels = q3.match(/<div role="tabpanel"[^>]*class="about-tab-panel[^>]*>/g) ?? []
  const cards = messages.about.q3.cards
  const titles = [cards.suitability, cards.congestion, cards.aiPlan, cards.indoor].map(
    (card) => card.title,
  )

  it('탭 목록 하나에 탭 넷 · 패널 넷이다', () => {
    expect(listStart).toBeGreaterThan(0)
    expect(tablist.match(/role="tab"/g)).toHaveLength(4)
    expect(panels).toHaveLength(4)
  })

  it('정적 렌더는 첫 항목이 골라져 있다 — 고른 탭만 탭 순서에 선다', () => {
    const tabs = tablist.match(/<button [^>]*role="tab"[^>]*>/g) ?? []
    expect(tabs.map((tab) => tab.includes('aria-selected="true"'))).toEqual([
      true,
      false,
      false,
      false,
    ])
    expect(tabs.map((tab) => tab.match(/tabindex="(-?\d)"/)?.[1])).toEqual(['0', '-1', '-1', '-1'])
    expect(panels.map((panel) => /\bis-selected\b/.test(panel))).toEqual([
      true,
      false,
      false,
      false,
    ])
  })

  it('탭과 패널이 서로를 가리킨다', () => {
    const tabs = [
      ...tablist.matchAll(/id="([^"]+)" aria-selected="[^"]+" aria-controls="([^"]+)"/g),
    ]
    expect(tabs).toHaveLength(4)
    for (const [, tabId, panelId] of tabs) {
      expect(q3).toContain(`id="${panelId}" aria-labelledby="${tabId}"`)
    }
  })

  it('탭 이름은 제목이다 — 설명은 aria-hidden 이고 패널 머리가 읽는다', () => {
    /* 버튼마다 본다 — 절 전체로 보면 패널 머리의 같은 제목에 속아 통과한다 */
    const buttons = tablist.match(/<button [^>]*role="tab"[^>]*>[\s\S]*?<\/button>/g) ?? []
    expect(buttons).toHaveLength(titles.length)
    buttons.forEach((button, index) => {
      const label = button.replace(/<span aria-hidden="true"[^>]*>[^<]*<\/span>/g, '')
      expect(label.replace(/<[^>]+>/g, ''), titles[index]).toContain(titles[index] ?? '')
    })
    const descs = q3.match(/<span aria-hidden="true" class="text-body-2 text-fg-muted mt-1 hidden/g)
    expect(descs).toHaveLength(4)
    expect(q3.match(/<div class="pt-4 lg:sr-only/g)).toHaveLength(4)
  })

  it('네 예시의 내용이 처음부터 DOM 에 있다 — 숨은 패널도 렌더된다', () => {
    expect(q3).toContain(messages.about.specimen.suitabilityGrade)
    expect(q3).toContain(`aria-label="${messages.about.specimen.congestionAria}"`)
    expect(q3).toContain(messages.about.specimen.planRegenerate)
    expect(q3).toContain(messages.about.specimen.suitabilityNote)
    expect(q3).toContain(messages.about.specimen.congestionNote)
    expect(q3).toContain(messages.about.specimen.indoorNote)
  })

  it('트랙(about-tour) 안에 sticky 한 화면(about-tour-sticky)이 있고 항목 수를 CSS 로 넘긴다', () => {
    expect(q3).toContain(
      `<div class="about-tour" style="--about-tour-count:${Object.keys(cards).length}"><div class="about-tour-sticky">`,
    )
  })

  it('밴드 위아래 여백을 1024 이상에서 걷는다 — 트랙이 절 높이를 정한다', () => {
    expect(q3).toMatch(/^aria-labelledby="about-q3-heading"[^>]*><div class="[^"]*\blg:py-0\b/)
  })

  it('예시 카드가 about-tab-card 다 — 1024 이상 최소 높이로 넷의 높이를 맞춘다', () => {
    expect(q3).toMatch(/<section class="[^"]*\babout-tab-card\b/)
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

describe('소개 문구 — 낱말 규칙 (#940 사용자 검토)', () => {
  /** `messages.about` 의 값 문자열 전부 — 키가 아니라 화면에 나가는 말만 */
  const strings = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(strings)
        : value !== null && typeof value === 'object'
          ? Object.values(value).flatMap(strings)
          : []
  const copy = strings(messages.about)

  it.each([
    ['판정', '심판받는 느낌이다 — 이름은 "오늘 상태", 문장은 "알려 줘요 · 안내해요"'],
    ['갈리', '"다른 · 나뉘는" 으로 쓴다'],
    ['거르', '장소를 거르지 않고 안내한다'],
    ['걸러', '장소를 거르지 않고 안내한다'],
    ['원천', '"데이터 · 출처" 로 쓴다'],
    ['서버가', '사용자에게는 "AI 로 생성해요" 처럼 하는 일을 말한다'],
  ])('"%s" 를 쓰지 않는다 — %s', (word) => {
    expect(copy.length).toBeGreaterThan(50)
    for (const text of copy) expect(text, text).not.toContain(word)
  })

  it('화면 마크업에도 없다 — 속성(aria-label 등)과 문구 밖에서 들어온 낱말까지', () => {
    for (const word of ['판정', '갈리', '거르', '걸러', '원천', '서버가']) {
      expect(markup).not.toContain(word)
    }
  })
})

describe('AboutView — 히어로 (#940)', () => {
  const hero = band('about-hero-heading')

  it('제목이 "반려견과 함께하는 제주 여행" 이고 작은 표지어 줄이 없다', () => {
    expect(messages.about.hero.heading).toBe('반려견과 함께하는 제주 여행')
    expect(hero).not.toMatch(/<p class="text-caption[^"]*tracking-wide/)
    expect(Object.keys(messages.about.hero)).not.toContain('eyebrow')
  })

  it('설명 문단이 없다 — 한 줄과 같은 말을 되풀이했다', () => {
    expect(Object.keys(messages.about.hero)).not.toContain('sub')
    expect(hero).not.toMatch(/<p class="text-body-1[^"]*opacity-90/)
  })

  it('제목 아래 한 줄이 쉼표 없이 선다 — "~, ~해요" 구조가 어색했다', () => {
    const [first, second] = messages.about.hero.lead
    expect(messages.about.hero.lead.join(' ')).not.toContain(',')
    expect(hero.indexOf(first)).toBeGreaterThan(hero.indexOf('id="about-hero-heading"'))
    expect(hero.indexOf(second)).toBeGreaterThan(hero.indexOf(first))
  })

  it('768 이상에서만 두 토막 사이에서 줄을 바꾼다 — 그 미만은 공백 하나로 이어 흐른다', () => {
    const [first, second] = messages.about.hero.lead
    expect(hero).toContain(`${first} <br aria-hidden="true" class="hidden md:inline"/>${second}`)
  })
})

describe('AboutView — 데이터 절 (#940)', () => {
  const data = band('about-data-heading')

  it('한 화면을 채운다 (about-screen-fill)', () => {
    expect(data).toMatch(
      /^aria-labelledby="about-data-heading"[^>]*><div class="[^"]*\babout-screen-fill\b/,
    )
  })

  it('규모 타일 셋이 라디오 묶음이고 정적 렌더는 장소가 골라져 있다 — 고른 것만 탭 순서에', () => {
    expect(data).toContain(`role="radiogroup" aria-label="${messages.about.data.scaleGroupLabel}"`)
    const tiles =
      data.match(
        /<button type="button" role="radio" aria-checked="(true|false)" tabindex="(-?\d)"/g,
      ) ?? []
    expect(tiles).toEqual([
      '<button type="button" role="radio" aria-checked="true" tabindex="0"',
      '<button type="button" role="radio" aria-checked="false" tabindex="-1"',
      '<button type="button" role="radio" aria-checked="false" tabindex="-1"',
    ])
  })

  it('장소를 고르면 구성 막대의 조각이 원천별 개수와 같다 — 합이 315 보다 큰 만큼이 겹치는 곳', () => {
    for (const count of SCALE_SPECIMEN.placesBreakdown) expect(data).toContain(`>${count}<`)
    const sum = SCALE_SPECIMEN.placesBreakdown.reduce((total, count) => total + count, 0)
    expect(sum).toBeGreaterThan(SCALE_SPECIMEN.places)
    expect(messages.about.data.placesSegments).toHaveLength(SCALE_SPECIMEN.placesBreakdown.length)
  })

  it('출처 쓰임은 푸터 출처와 같은 순서 · 같은 길이이고, 고른 숫자의 출처만 강조된다', () => {
    expect(messages.about.data.sourceUses).toHaveLength(messages.footer.sources.length)
    const chips = [...data.matchAll(/<li class="([^"]*)"><span[^>]*>([^<]+)<\/span>/g)].filter(
      (match) => (messages.footer.sources as readonly string[]).includes(match[2] ?? ''),
    )
    expect(chips).toHaveLength(messages.footer.sources.length)
    const linked = chips.filter((match) => match[1]?.includes('border-brand-500')).map((m) => m[2])
    expect(linked).toEqual(
      SCALE_SPECIMEN.sourceIndexes.places.map((index) => messages.footer.sources[index]),
    )
  })

  it('약관이 알아두실 점 바로 뒤에 선다', () => {
    const notice = data.indexOf('id="about-notice-heading"')
    const legal = data.indexOf('id="about-legal-heading"')
    expect(notice).toBeGreaterThan(0)
    expect(legal).toBeGreaterThan(notice)
    // 사이에 다른 카드 제목이 없다 — 약관 제목 하나만
    expect(data.slice(notice, legal).match(/<h2/g)).toHaveLength(1)
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
