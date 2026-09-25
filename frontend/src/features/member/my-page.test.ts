import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AccountSection } from '@/features/member/account-section'
import { MyPageSections, type MyPageSectionsProps } from '@/features/member/my-page-sections'
import { LEGAL_LINKS } from '@/lib/legal/links'
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

/**
 * 글자가 `label` 인 `<button>` 의 여는 태그부터 닫는 태그까지. **여는 태그로 범위를 좁힌다** —
 * 마크업 전체에 클래스를 단언하면 다른 요소의 클래스로 초록이 된다. 없으면 빈 문자열.
 */
function actionButton(markup: string, label: string): string {
  const at = markup.indexOf(`>${label}</span></button>`)
  if (at === -1) return ''
  const start = markup.lastIndexOf('<button', at)
  return markup.slice(start, markup.indexOf('</button>', at) + '</button>'.length)
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
      onWithdraw: () => undefined,
      onEditProfile: () => undefined,
      ...overrides,
    }),
  )
}

describe('MyPageSections — 상태별 화면 (D5)', () => {
  it('회원 정보를 렌더한다', () => {
    const markup = render()

    expect(markup).toContain('제주댕댕')
    expect(markup).toContain('demo@hondigagae.dev')
  })

  /*
    **이름이 아니라 닉네임이다.** 이 화면에서 고칠 수 있는 것이 닉네임뿐이라, 이름을 적으면
    닉네임을 바꿔도 이 줄이 그대로여서 저장이 안 된 것처럼 읽혔다.
  */
  it('프로필 줄은 이름이 아니라 닉네임을 쓴다', () => {
    expect(render()).not.toContain('김제주')
  })

  it('닉네임이 비어 있으면 이름으로 떨어진다 — 빈 줄을 남기지 않는다', () => {
    const markup = render({ member: member({ nickname: '  ' }) })

    expect(markup).toContain('김제주')
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
    expect(markup).toContain('제주댕댕')
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

  /*
    **둘 다 동작이라 `<button>` 이다** (D6). 탈퇴는 `/mypage/withdraw` 로 가는 링크였는데,
    이제 이 화면 위에 확인 모달을 연다 — 라우트 이동이 없다.
  */
  it('로그아웃 · 회원탈퇴가 모두 button 이고 탈퇴 라우트로 가지 않는다', () => {
    const markup = render()

    expect(actionButton(markup, messages.member.logout)).not.toBe('')
    expect(actionButton(markup, messages.member.withdraw)).not.toBe('')
    expect(markup).not.toContain('/mypage/withdraw')
  })

  /*
    **회원탈퇴만 붉은 글자다.** 되돌릴 수 없는 유일한 행이라 한눈에 갈려야 한다. 로그아웃은
    되돌릴 수 있어 중립 글자 — 둘이 같은 경고색이면 무게가 같아진다.
  */
  it('회원탈퇴는 danger 글자색, 로그아웃은 아니다', () => {
    const markup = render()

    expect(actionButton(markup, messages.member.withdraw)).toContain('text-danger-700')
    expect(actionButton(markup, messages.member.logout)).not.toMatch(/danger/)
  })

  /** 이동이 아니라 동작이라 꺾쇠가 없다 — 꺾쇠는 "다른 화면으로 간다" 는 신호다 */
  it('동작 행에는 꺾쇠가 없다', () => {
    const markup = render()

    expect(actionButton(markup, messages.member.logout)).not.toContain('<svg')
    expect(actionButton(markup, messages.member.withdraw)).not.toContain('<svg')
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
    return renderToStaticMarkup(
      createElement(AccountSection, {
        state,
        provider,
        onLogout: () => undefined,
        onWithdraw: () => undefined,
      }),
    )
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
   * #610 에서 문서와 페이지가 생겼다. **규칙이 바뀐 것이 아니라 전제가 채워진 것이다** —
   * "API 없이 진입점만 만들지 않는다" 는 그대로고, 이제 대상이 실재한다 (D8-1).
   */
  it('이용약관·개인정보 처리방침을 실재 라우트로 건다', () => {
    const markup = account('general', null)

    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
      expect(markup).toContain(link.label)
    }
  })

  /*
    **계정 상태와 무관하게 나온다.** 약관은 소셜 계정에도 비밀번호 계정에도, 판별
    불가(`unknown`)한 계정에도 똑같이 적용된다 — 상태로 갈리면 어떤 회원은 자기에게
    적용되는 문서에 마이페이지에서 닿지 못한다. 네 상태를 전부 돈다 — `general` ·
    `unknown` 만 보면 `social-only` · `linked` 에서 조용히 조건에 걸려도 잡지 못한다.
  */
  it.each([
    ['general', null],
    ['social-only', 'KAKAO'],
    ['linked', 'KAKAO'],
    ['unknown', null],
  ] as const)('계정 상태가 %s 이어도 약관 항목은 나온다', (state, provider) => {
    const markup = account(state, provider)

    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
    }
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
/**
 * **두 행의 리딩 슬롯이 같은 폭이어야 글줄이 한 세로선에 선다** — 이슈 #468.
 *
 * 예전에는 `내 반려견` 이 아바타 N개를 겹쳐 폭이 `32 + 24(N-1)` 로 변했고 0마리면 블록
 * 자체가 사라졌다. 390 실측에서 글줄이 16(0마리) · 60(1) · 84(2) · 156(5) 으로 움직여
 * **어느 마릿수에서도** 바로 아래 `저장한 장소`(68)와 맞지 않았다.
 *
 * **여기서 재는 것은 좌표가 아니라 구조다** — node 환경이라 레이아웃이 없다
 * (`testing-guide.md` §1). 두 행의 리딩이 **같은 `size-10` 원형 하나**이고 마릿수에
 * 따라 개수가 변하지 않는다는 것을 본다. 실제 좌표는 `e2e/surface.spec.ts` 가 잰다.
 */
describe('마이페이지 첫 카드의 리딩 슬롯 (#468)', () => {
  const COUNTS = [0, 1, 2, 5] as const

  function leadingCircles(markup: string): number {
    return (markup.match(/size-10/g) ?? []).length
  }

  it.each(COUNTS)('반려견 %i마리에서도 리딩 원형은 둘뿐이다 — 두 행이 하나씩', (count) => {
    const pets = Array.from({ length: count }, (_, index) =>
      pet({ petId: `12345678901200000${index + 1}`, name: `개${index + 1}` }),
    )

    expect(leadingCircles(render({ pets, petsTotalCount: count }))).toBe(2)
  })

  /*
    **0마리에서 슬롯이 사라지지 않는다.** 그때 글줄이 16 까지 당겨지던 것이 이 이슈에서
    가장 크게 벌어진 자리(52px)였다. 등록하러 가는 행이 되므로 채움은 `PlusIcon` 이다.
  */
  it('0마리면 슬롯에 PlusIcon 이 선다 — 비우지 않는다', () => {
    const markup = render({ pets: [], petsTotalCount: 0 })

    expect(markup).toContain('bg-band')
    expect(leadingCircles(markup)).toBe(2)
  })

  /*
    **개수를 세는 일은 부제가 한다.** 아바타를 하나로 줄인 근거라, 부제가 실제로 이름과
    `N/5` 를 내는지 함께 잠근다 — 한쪽이 사라지면 슬롯 결정의 전제가 깨진다.
  */
  it('부제가 이름 전부와 N/5마리 를 낸다 — 아바타를 하나로 줄인 전제다', () => {
    const pets = [pet({ name: '몽실이' }), pet({ petId: '123456789012000002', name: '보리' })]
    const markup = render({ pets, petsTotalCount: 2 })

    expect(markup).toContain('몽실이 · 보리')
    expect(markup).toContain(messages.pet.countOfMax.replace('{count}', '2').replace('{max}', '5'))
  })
})

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

  /*
    **로그아웃·회원탈퇴는 `계정` 카드의 마지막 두 행이다.** 카드 밖 L0 에 버튼 하나와 링크
    하나로 떠 있을 때는 어느 묶음에도 속하지 않은 것처럼 보였다 — `버전` 행 아래에 같은 행
    모양으로 선다.
  */
  it('로그아웃·회원탈퇴는 계정 카드 안, 버전 행 아래에 있다', () => {
    const markup = render()
    const accountCard = markup.slice(
      markup.lastIndexOf('<section'),
      markup.lastIndexOf('</section>'),
    )
    const version = accountCard.indexOf(messages.member.version)

    expect(accountCard).toContain(messages.member.accountSection)
    expect(version).toBeGreaterThan(-1)
    expect(accountCard.indexOf(`>${messages.member.logout}<`)).toBeGreaterThan(version)
    expect(accountCard.indexOf(`>${messages.member.withdraw}<`)).toBeGreaterThan(
      accountCard.indexOf(`>${messages.member.logout}<`),
    )
    // 카드 밖에는 아무것도 남지 않는다
    expect(markup.slice(markup.lastIndexOf('</section>'))).not.toContain(messages.member.logout)
  })

  /** 소셜 연결·비밀번호 유무가 전부 회원 정보에서 온다 — 값 없이 그리면 단정이 된다 (D5) */
  it('회원 정보 조회에 실패하면 계정 카드를 내지 않는다', () => {
    const markup = render({ member: null, errorStatus: 503 })

    expect(tags(markup, 'section')).toHaveLength(1)
    expect(markup).not.toContain(messages.member.accountSection)
    expect(markup).toContain(messages.common.retry)
  })

  /**
   * **캐시가 살아 있는 채로 refetch 만 실패하는 경로가 실제로 있다** — 페이지가
   * `/members/me` 를 프리페치하므로 `staleTime` 이 지난 뒤 재조회가 5xx 면 `member` 는
   * 남고 `errorStatus` 만 채워진다. 오류 판정을 `member === null` 로만 하면 그 구간에서
   * 계정 카드만 말없이 사라지고 오류도 재시도도 나오지 않는다.
   */
  it('회원 정보가 캐시에 남아 있어도 errorStatus 가 있으면 오류와 재시도를 낸다', () => {
    const markup = render({ member: member(), errorStatus: 503 })

    expect(markup).toContain(messages.member.loadFailedTitle)
    expect(markup).toContain(messages.common.retry)
    expect(markup).not.toContain(messages.member.accountSection)
  })

  /** 2a 는 두 상태에서 early return 이라 액션이 없었다 — 층을 옮기며 새어 나가지 않게 */
  it('로딩·오류에서는 로그아웃·회원탈퇴를 내지 않는다', () => {
    for (const state of [{ loading: true }, { member: null, errorStatus: 503 }]) {
      const markup = render(state)

      expect(markup).not.toContain(messages.member.logout)
      expect(markup).not.toContain(`>${messages.member.withdraw}<`)
    }
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
    return renderToStaticMarkup(
      createElement(AccountSection, {
        state,
        provider,
        onLogout: () => undefined,
        onWithdraw: () => undefined,
      }),
    )
  }

  /** 카드는 `MyPageSections` 가 그린다 — 여기서 또 그리면 카드 여백이 두 번 낀다 (§3-1) */
  it('자기 카드를 그리지 않는다', () => {
    expect(account('general', null)).not.toContain('<section')
  })

  /**
   * **#610 이후 `unknown` 도 빈 목록이 아니다** — 읽기·이동 항목은 없어도 약관 항목
   * 둘은 상태와 무관하게 항상 들어온다. `toContain('<ul')` 만으로는 증명되지 않는다 —
   * `SurfaceList` 의 `<ul>` 은 `hasItems` 래핑을 걷은 뒤로 내부가 비어 있어도 항상
   * 렌더되므로, 여기서는 **약관 링크의 `href` 가 실제로 들어 있는지** 를 본다. 그래야
   * `LEGAL_LINKS.map` 이 다시 `state` 조건 안으로 들어가는 회귀를 이 테스트가 잡는다.
   * `dl` 의 `border-t` 도 항상 선다 — "허공의 선을 만들지 않는다" 는 이제 반대
   * 방향(항상 선을 긋는다)으로 지켜진다.
   */
  it('판별 불가여도 약관 항목은 실재 라우트로 나오고 구분선도 항상 선다', () => {
    const markup = account('unknown', null)

    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
    }
    expect(/<dl\b[^>]*>/.exec(markup)?.[0]).toContain('border-t')
  })

  /** 항목이 있을 때는 버전 줄이 목록과 갈리는 선을 스스로 든다 (목록 선은 자기 li 사이에만 걸린다) */
  it('항목이 있으면 버전 줄이 위 구분선을 갖는다', () => {
    const markup = account('general', null)

    expect(markup).toContain('<ul')
    expect(/<dl\b[^>]*>/.exec(markup)?.[0]).toContain('border-t')
  })
})
