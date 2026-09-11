import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AccountSection } from '@/features/member/account-section'
import { MyPageSections, type MyPageSectionsProps } from '@/features/member/my-page-sections'
import { messages } from '@/lib/messages'
import type { MemberMyInfo } from '@/types/member'
import type { Pet } from '@/types/pet'

function member(overrides: Partial<MemberMyInfo> = {}): MemberMyInfo {
  return {
    memberId: '900000000000000001',
    email: 'demo@hondigagae.dev',
    name: '김제주',
    nickname: '제주댕댕',
    profileImageUrl: null,
    role: { code: 'USER', name: '일반 회원', description: '일반 회원 권한입니다.' },
    provider: null,
    hasPassword: true,
    ...overrides,
  }
}

function pet(overrides: Partial<Pet> = {}): Pet {
  return {
    petId: '123456789012000001',
    name: '몽실이',
    breed: '말티즈',
    birthYm: '2017-05',
    age: 9,
    sizeType: { code: 'SMALL', name: '소형견', description: '체중 10kg 미만' },
    weightKg: null,
    profileImageUrl: null,
    representative: false,
    heatSensitive: false,
    coldSensitive: false,
    noiseSensitive: false,
    activityLevel: { code: 'MEDIUM', name: '보통', description: '일반적인 산책과 관광 일정' },
    walkPreferred: false,
    sociality: { code: 'HIGH', name: '높음', description: '잘 어울립니다.' },
    ...overrides,
  }
}

function render(overrides: Partial<MyPageSectionsProps> = {}) {
  return renderToStaticMarkup(
    createElement(MyPageSections, {
      member: member(),
      loading: false,
      errorStatus: null,
      pets: [pet()],
      petsLoading: false,
      petsTotalCount: 1,
      favoritesTotalCount: 3,
      favoritesLoading: false,
      onRetry: () => undefined,
      onLogout: () => undefined,
      onEditProfile: () => undefined,
      ...overrides,
    }),
  )
}

describe('MyPageSections — 상태별 화면 (D5)', () => {
  it('회원 정보를 렌더한다', () => {
    const markup = render()

    expect(markup).toContain('김제주')
    expect(markup).toContain('demo@hondigagae.dev')
  })

  it('5xx 는 ErrorState 이고 재시도 버튼이 있다', () => {
    const markup = render({ member: null, errorStatus: 500 })

    expect(markup).toContain(messages.member.loadFailedTitle)
    expect(markup).toContain(messages.common.retry)
  })

  /** 두 조회의 실패를 합치지 않는다 — 반려견이 실패해도 회원 정보는 그대로다 (D5) */
  it('반려견 조회 실패는 그 행만 숨기고 나머지는 유지한다', () => {
    const markup = render({ pets: null })

    expect(markup).not.toContain(messages.member.myPets)
    // 회원 정보와 계정 섹션은 그대로 보인다
    expect(markup).toContain('김제주')
    expect(markup).toContain(messages.member.accountSection)
    expect(markup).toContain(messages.member.logout)
  })

  it('반려견 0마리는 행을 남기고 문구만 바꾼다 — 실패(null)와 다르다', () => {
    const markup = render({ pets: [], petsTotalCount: 0 })

    expect(markup).toContain(messages.member.myPets)
    expect(markup).toContain(messages.member.petsEmpty)
  })

  it('반려견 이름과 N/5 를 함께 보여준다', () => {
    const markup = render({
      pets: [pet(), pet({ petId: '123456789012000002', name: '초코' })],
      petsTotalCount: 2,
    })

    expect(markup).toContain('몽실이 · 초코')
    expect(markup).toContain('2/5')
  })

  it('프로필 이미지가 없으면 img 대신 이니셜 자리(아이콘)를 그린다 — 빈 원형을 남기지 않는다', () => {
    const markup = render({ member: member({ profileImageUrl: null }) })

    expect(markup).not.toContain('<img')
    expect(markup).toContain('<svg')
  })

  it('프로필 이미지가 있으면 그 URL 을 렌더한다', () => {
    const url = 'https://minio.hondigagae.com/hondigagae/members/profiles/a.png'
    const markup = render({ member: member({ profileImageUrl: url }) })

    expect(markup).toContain(url)
  })

  /** 이동 항목은 `<a>`, 동작 항목은 `<button>` — 모양이 같아도 역할이 다르다 (D6) */
  it('로그아웃은 button, 회원탈퇴는 a 다', () => {
    const markup = render()

    expect(markup).toMatch(/<button[^>]*>로그아웃<\/button>/)
    expect(markup).toMatch(/<a[^>]*href="\/mypage\/withdraw"/)
  })

  it('반려견 행은 이동이라 a 다', () => {
    expect(render()).toMatch(/<a[^>]*href="\/pets"/)
  })

  /** `수정` 은 모달을 여는 동작이라 이동(`<a>`)이 아니다 (D6) */
  it('수정은 button 이다', () => {
    expect(render()).toMatch(/<button[^>]*>수정<\/button>/)
  })
})

describe('AccountSection — 계정 상태 3종이 다르게 그려진다 (D5)', () => {
  function account(state: Parameters<typeof AccountSection>[0]['state'], provider: string | null) {
    return renderToStaticMarkup(createElement(AccountSection, { state, provider }))
  }

  it('일반 계정은 비밀번호 변경만 있고 연결 표시가 없다', () => {
    const markup = account('general', null)

    expect(markup).toContain(messages.member.passwordChange)
    expect(markup).not.toContain('연결됨')
  })

  it('소셜 전용은 연결 표시 + 비밀번호 설정이다 — "변경" 이 아니다', () => {
    const markup = account('social-only', 'KAKAO')

    expect(markup).toContain(messages.member.linkedWith('카카오'))
    expect(markup).toContain(messages.member.passwordSetup)
    expect(markup).not.toContain(messages.member.passwordChange)
  })

  it('연결됨은 연결 표시 + 비밀번호 변경이다', () => {
    const markup = account('linked', 'KAKAO')

    expect(markup).toContain(messages.member.linkedWith('카카오'))
    expect(markup).toContain(messages.member.passwordChange)
  })

  it('판별 불가면 비밀번호 항목을 하나도 내지 않는다', () => {
    const markup = account('unknown', null)

    expect(markup).not.toContain(messages.member.passwordChange)
    expect(markup).not.toContain(messages.member.passwordSetup)
    expect(markup).not.toMatch(/href="\/mypage\/password"/)
  })

  /**
   * 링크 대상 문서가 아직 없다 — "API 없이 진입점만 만들지 않는다" 와 같은 규칙이다 (D8-1).
   * 이 단언이 깨지면 죽은 링크를 되살린 것이다.
   */
  it('이용약관·개인정보 처리방침을 아직 렌더하지 않는다', () => {
    const markup = account('general', null)

    expect(markup).not.toContain('이용약관')
    expect(markup).not.toContain('개인정보 처리방침')
  })

  /** 조작할 수 없는 정보라 목록 항목이 아니라 정의 목록이다 (D6) */
  it('버전은 li 가 아니라 dl 로 그린다', () => {
    const markup = account('general', null)

    expect(markup).toContain('<dl')
    expect(markup).toMatch(/<dt[^>]*>버전<\/dt>/)
  })
})

/**
 * 3층 표면 (`DESIGN.md §0`, 이슈 #466). **층이 아니라 규약을 잠근다** — 색·여백은
 * `fe-design-reviewer` 의 브라우저 검토가 보고, 여기서는 마크업에 드러나는 것만 본다:
 * 카드 수, 무엇이 카드 안이고 무엇이 밖인지, 선을 누가 긋는지.
 */
describe('MyPageSections — 3층 표면 (#466)', () => {
  /** `class` 를 토큰으로 쪼갠다. 문자열 `toContain` 은 `border-border` 안의 `border-b` 에 걸린다 */
  function classTokens(tag: string): string[] {
    return (/class="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/).filter(Boolean)
  }

  function tags(markup: string, name: string): string[] {
    return [...markup.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((match) => match[0])
  }

  it('카드가 둘이다 — 내 정보(프로필·반려견·저장한 장소)와 계정', () => {
    const markup = render()

    expect(tags(markup, 'section')).toHaveLength(2)
    expect(markup).toMatch(new RegExp(`<h2[^>]*>${messages.member.myPageTitle}</h2>`))
    expect(markup).toMatch(new RegExp(`<h2[^>]*>${messages.member.accountSection}</h2>`))
  })

  /** 프로필은 혼자 카드가 되지 못한다 (판정 ①③) — 반려견·저장한 장소와 같은 카드에 든다 */
  it('프로필과 두 진입점이 같은 카드 안에 있다', () => {
    const markup = render()
    const firstCardEnd = markup.indexOf('</section>')

    expect(markup.indexOf('김제주')).toBeLessThan(firstCardEnd)
    expect(markup.indexOf(messages.member.myPets)).toBeLessThan(firstCardEnd)
    expect(markup.indexOf(messages.favorite.entryLabel)).toBeLessThan(firstCardEnd)
  })

  it('반려견·저장한 장소는 목록 항목(li)이고 항목이 자기 구분선을 긋지 않는다', () => {
    const markup = render()
    const items = tags(markup, 'li')

    expect(items.length).toBeGreaterThanOrEqual(2)
    for (const item of items) {
      expect(classTokens(item)).not.toContain('border-t')
      expect(classTokens(item)).not.toContain('border-b')
    }
    // 선 규약은 목록이 갖는다 — 항목 사이에만 긋는다.
    // 마크업에서는 `&`·`>` 가 엔티티로 이스케이프된다
    expect(markup).toContain('[&amp;&gt;li+li]:border-t')
  })

  /** 액션은 카드가 아니다 (§0 판정에서 "액션 바" 가 빠진다) */
  it('로그아웃·회원탈퇴는 마지막 카드 밖에 있다', () => {
    const markup = render()
    const lastCardEnd = markup.lastIndexOf('</section>')

    expect(markup.indexOf(messages.member.logout)).toBeGreaterThan(lastCardEnd)
    expect(markup.indexOf(messages.member.withdraw)).toBeGreaterThan(lastCardEnd)
  })

  /** 소셜 연결·비밀번호 유무가 전부 회원 정보에서 온다 — 값 없이 그리면 단정이 된다 (D5) */
  it('회원 정보 조회에 실패하면 계정 카드를 내지 않는다', () => {
    const markup = render({ member: null, errorStatus: 503 })

    expect(tags(markup, 'section')).toHaveLength(1)
    expect(markup).not.toContain(messages.member.accountSection)
    expect(markup).toContain(messages.common.retry)
  })

  /** 제목까지 스켈레톤으로 지우면 조회가 끝나는 순간 카드 높이와 경계가 함께 뛴다 (#451) */
  it('로딩 중에도 카드 둘과 그 제목이 서 있다', () => {
    const markup = render({ loading: true })

    expect(tags(markup, 'section')).toHaveLength(2)
    expect(markup).toContain(messages.member.myPageTitle)
    expect(markup).toContain(messages.member.accountSection)
    expect(markup).toContain('aria-busy')
  })
})

describe('AccountSection — 카드 안 내용만 낸다 (#466)', () => {
  function account(state: Parameters<typeof AccountSection>[0]['state'], provider: string | null) {
    return renderToStaticMarkup(createElement(AccountSection, { state, provider }))
  }

  /** 카드는 `MyPageSections` 가 그린다 — 여기서 또 그리면 카드 여백이 두 번 낀다 (§3-1) */
  it('자기 카드를 그리지 않는다', () => {
    expect(account('general', null)).not.toContain('<section')
  })

  /**
   * `unknown` 은 읽기 항목도 이동 항목도 내지 않는다. 그때 빈 `ul` 과 그 아래 `border-t`
   * 를 그리면 카드 제목 바로 밑에 허공에 선이 하나 뜬다.
   */
  it('판별 불가면 빈 목록도 허공 구분선도 만들지 않는다', () => {
    const markup = account('unknown', null)

    expect(markup).not.toContain('<ul')
    expect(/<dl\b[^>]*>/.exec(markup)?.[0]).not.toContain('border-t')
  })

  /** 항목이 있을 때는 버전 줄이 목록과 갈리는 선을 스스로 든다 (목록 선은 자기 li 사이에만 걸린다) */
  it('항목이 있으면 버전 줄이 위 구분선을 갖는다', () => {
    const markup = account('general', null)

    expect(markup).toContain('<ul')
    expect(/<dl\b[^>]*>/.exec(markup)?.[0]).toContain('border-t')
  })
})
