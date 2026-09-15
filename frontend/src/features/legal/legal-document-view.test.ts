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
