import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { LegalDocumentView } from '@/features/legal/legal-document-view'
import { privacyPolicy } from '@/lib/legal/privacy-policy'
import { termsOfService } from '@/lib/legal/terms-of-service'
import { messages } from '@/lib/messages'

/**
 * 약관 렌더러 — 이슈 #610.
 *
 * **상태가 없는 서버 컴포넌트라 통째로 렌더된다** (`testing-guide.md` §1).
 */
const terms = renderToStaticMarkup(createElement(LegalDocumentView, { doc: termsOfService }))
const privacy = renderToStaticMarkup(createElement(LegalDocumentView, { doc: privacyPolicy }))

describe('LegalDocumentView — 문서 머리 (#610)', () => {
  it('제목과 시행일을 낸다', () => {
    expect(terms).toContain(termsOfService.title)
    expect(terms).toContain(termsOfService.effectiveDate)
    expect(terms).toContain(messages.legal.effectiveDateLabel)
  })
})

describe('LegalDocumentView — 목차와 앵커 (#610)', () => {
  /*
    목차가 가리키는 자리가 실제로 있어야 한다. 앵커만 있고 `id` 가 없으면 눌러도
    아무 일이 일어나지 않는다 — 긴 문서에서 이것이 가장 티 안 나는 고장이다.
  */
  it('모든 조문에 목차 링크와 대응하는 id 가 있다', () => {
    for (const article of termsOfService.articles) {
      expect(terms).toContain(`href="#article-${article.no}"`)
      expect(terms).toContain(`id="article-${article.no}"`)
    }
  })

  it('목차를 nav 로 감싸 건너뛸 수 있게 한다', () => {
    expect(terms).toContain(`aria-label="${messages.legal.tocLabel}"`)
  })

  it('조문 제목이 "제N조(제목)" 형태다', () => {
    expect(terms).toContain(`${messages.legal.articleLabel(10)}(정보의 정확성과 한계)`)
  })
})

describe('LegalDocumentView — 블록 (#610)', () => {
  it('표를 <table> 로 그린다 — 처리방침의 수집 항목 표', () => {
    expect(privacy).toContain('<table')
    expect(privacy).toContain('<th')
    expect(privacy).toContain(
      '반려견 이름, 견종, 출생 연월, 크기, 체중, 활동량, 산책 선호도, 사회성, 환경 민감도, 사진',
    )
  })

  /* 가로 폭이 좁으면 표가 화면을 밀어낸다 — DESIGN.md §7 이 버그로 못박은 증상이다 */
  it('표를 가로 스크롤 컨테이너에 넣는다', () => {
    expect(privacy).toContain('overflow-x-auto')
  })

  it('목록을 <ul> 로 그린다', () => {
    expect(terms).toContain('<ul')
    expect(terms).toContain('만 14세 미만인 사람은 회원으로 가입할 수 없습니다.')
  })
})

describe('LegalDocumentView — 개정 이력 (#610)', () => {
  /* 조작할 수 없는 정보라 목록 항목이 아니라 정의 목록이다 (마이페이지 버전 줄과 같은 판단) */
  it('개정 이력을 dl 로 그린다', () => {
    expect(terms).toContain(messages.legal.historyLabel)
    expect(terms).toContain('<dl')
    expect(terms).toContain('최초 제정')
  })
})

describe('LegalDocumentView — 핵심 조문이 빠지지 않는다 (#610)', () => {
  /*
    이 두 문장이 이 서비스의 실제 리스크다 — 추정값을 믿고 나갔다가 반려견이 다치는
    상황이 물리적으로 가능하다. 문구를 손대다 지우면 여기서 걸린다.
  */
  it('AI·안전 판정이 추정값이고 수의학적 판단을 대체하지 않는다고 말한다', () => {
    expect(terms).toContain('노면 온도는 실측값이 아니라 추정치입니다')
    expect(terms).toContain('수의학적 판단을 대체하지 않습니다')
  })

  it('AI 입력이 외부 사업자로 나가지 않는다고 말한다', () => {
    expect(privacy).toContain('외부 인공지능 사업자에게 전송되지 않습니다')
  })
})

/**
 * L1 카드의 여는 태그 **꼬리**. 클래스 문자열은 `Surface` 의 계약이다
 * (`components/surface.tsx`).
 *
 * **여는 태그로 범위를 좁힌다.** 마크업 전역에 `toContain('bg-bg')` 를 거는 식이면 카드가
 * 어디에 있든 통과해서, 카드가 본문이 아니라 엉뚱한 곳에만 남아도 초록으로 지나간다.
 *
 * **`<section` 부터 적지 않는다** — `titleId` 를 받은 카드는 그 사이에
 * `aria-labelledby` 가 끼어 머리 카드만 매칭에서 빠진다.
 */
const L1_CARD = 'class="bg-bg border-border border-y md:rounded-lg md:border">'

describe('LegalDocumentView — 3층 표면', () => {
  /*
    #610 은 본문을 L0 회색 바닥 위 맨 글줄로 두었다 — 제품에서 본문이 카드 밖에 있는
    유일한 화면이었다. 조문이 카드 **안**에 있는지를 "카드 여는 태그와 조문 사이에 닫는
    태그가 없다" 로 잰다. 카드를 걷으면 가장 가까운 앞 카드가 목차 카드가 되고, 그 사이에
    목차 카드의 `</section>` 이 끼어 실패한다.
  */
  it('조문이 L1 카드 안에 있다', () => {
    const article = privacy.indexOf('id="article-1"')
    const cardOpen = privacy.lastIndexOf(L1_CARD, article)

    expect(cardOpen).toBeGreaterThan(-1)
    expect(privacy.slice(cardOpen, article)).not.toContain('</section>')
  })

  /*
    **머리도 카드다.** §0 의 "페이지 머리는 카드가 아니다" 를 이 화면에서 뒤집은 것은
    아래가 전부 흰 카드이기 때문이다 — 머리만 회색 바닥에 얹히면 화면의 이름이 가장 덜
    중요해 보인다 (장소 상세 #531 과 같은 판단). 컴포넌트 머리주석이 근거를 갖고 있다.
  */
  it('문서 제목과 시행일이 L1 카드 안에 있다', () => {
    const title = privacy.indexOf('<h1')
    const cardOpen = privacy.lastIndexOf(L1_CARD, title)

    expect(cardOpen).toBeGreaterThan(-1)
    expect(privacy.slice(cardOpen, title)).not.toContain('</section>')
    /* 카드 이름은 `h1` 을 가리킨다 — `aria-label` 로 같은 문자열을 다시 적지 않는다 */
    expect(privacy).toContain(`aria-labelledby="legal-document-title"`)
    expect(privacy).toContain(`id="legal-document-title"`)
  })

  /* 조문 사이만 긋는다 — 첫 조문 위에 선이 생기면 카드 제목선처럼 읽힌다 */
  it('조문 경계를 인접 형제 구분선으로 긋는다', () => {
    expect(privacy).toContain('[&amp;&gt;section+section]:border-t')
  })

  /*
    개정 이력은 문서 본문이 아니라 그 문서에 대한 메타라 묶음이 다르다 (§0).
    **본문 카드와 다른 카드**여야 한다 — 같은 카드로 합치면 제14조 다음 절처럼 읽힌다.
  */
  it('개정 이력이 본문과 다른 카드다', () => {
    /* 제12조 본문에도 `개정 이력` 이라는 말이 있어 제목 쪽을 집는다 */
    const heading = privacy.indexOf(`font-semibold">${messages.legal.historyLabel}<`)
    const article = privacy.indexOf('id="article-1"')

    expect(heading).toBeGreaterThan(-1)
    expect(privacy.lastIndexOf(L1_CARD, heading)).toBeGreaterThan(
      privacy.lastIndexOf(L1_CARD, article),
    )
  })
})

describe('LegalDocumentView — 목차 레일', () => {
  /*
    DOM 순서가 `머리 → 목차 → 본문` 이어야 한다. 데스크톱 2단은 `.rail-layout-detail` 의
    grid 배치가 만들고(`app/globals.css`), 그 아래에서는 이 순서 그대로 쌓인다 —
    트리를 폭마다 둘로 나누면 같은 목차가 두 번 렌더돼 스크린리더가 중복해 읽는다.
  */
  it('목차가 좌측 레일 열에 서고 본문보다 앞에 온다', () => {
    const aside = privacy.indexOf('rail-detail-aside')
    const toc = privacy.indexOf(`aria-label="${messages.legal.tocLabel}"`)

    expect(aside).toBeGreaterThan(-1)
    expect(toc).toBeGreaterThan(aside)
    expect(privacy.lastIndexOf('rail-detail-main')).toBeGreaterThan(toc)
  })

  /*
    **`hidden lg:block` 을 달지 않는다.** 일정 상세의 `PlanVerdictToc` 는 그렇게 하지만
    거기는 같은 정보가 본문에도 있다. 여기 목차는 가입 전 모바일에서 제14조로 가는
    유일한 지름길이고, 숨기면 6000px 을 손으로 굴러야 한다.
  */
  it('좁은 폭에서도 목차를 숨기지 않는다', () => {
    /*
      **여는 태그 **처음**부터 잰다.** `indexOf('rail-detail-aside')` 부터 자르면 그 앞에
      붙은 `hidden lg:block` 이 잘려 나가 뮤테이션이 초록으로 지나갔다 (실제로 났다).
    */
    const aside = privacy.lastIndexOf('<div', privacy.indexOf('rail-detail-aside'))
    const lastLink = privacy.indexOf(
      `href="#article-${privacyPolicy.articles[privacyPolicy.articles.length - 1]?.no}"`,
    )

    expect(lastLink).toBeGreaterThan(aside)
    expect(privacy.slice(aside, lastLink)).not.toContain('hidden')
  })

  /* 모바일 최소 터치 영역 44×44 (DESIGN.md §7-1) — 링크 열넷이 전부 이 규칙 아래다 */
  it('목차 링크가 44 높이를 갖는다', () => {
    const open = privacy.indexOf('<a href="#article-1"')
    const close = privacy.indexOf('</a>', open)

    expect(privacy.slice(open, close)).toContain('min-h-11')
  })
})
