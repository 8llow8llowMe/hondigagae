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
