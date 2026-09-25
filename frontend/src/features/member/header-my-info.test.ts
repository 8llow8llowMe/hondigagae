import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { memberKeys } from '@/features/member/queries'
import { replaceMyInfo, setMyInfo } from '@/features/member/use-my-info'
import type { MemberMyInfo } from '@/types/member'

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

const PHOTO = 'https://minio.hondigagae.com/hondigagae/members/profiles/a.png'

/*
  **헤더는 페이지와 다른 key 를 든다** (`memberKeys.header` 주석). 레이아웃이 `me()` 를 먼저
  만들면 `/mypage` 의 `HydrationBoundary` 가 프리페치를 effect 뒤로 미뤄 하이드레이션이 깨졌다.
*/
describe('전역 헤더의 내 정보 사본', () => {
  it('헤더 key 는 페이지 key 와 다르다', () => {
    expect(memberKeys.header()).not.toEqual(memberKeys.me())
  })

  it('계정 메뉴는 useMyInfo 가 아니라 헤더 사본을 쓴다', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../nav/account-menu.tsx', import.meta.url)),
      'utf8',
    )

    expect(source).toContain('useHeaderMyInfo()')
    expect(source).not.toMatch(/\buseMyInfo\(/)
  })

  it('사진 업로드(부분 갱신)는 두 사본을 함께 바꾼다', () => {
    const client = new QueryClient()
    client.setQueryData(memberKeys.me(), member())
    client.setQueryData(memberKeys.header(), member())

    const updated = setMyInfo(client, (current) => ({ ...current, profileImageUrl: PHOTO }))

    expect(updated).toBe(true)
    expect(client.getQueryData<MemberMyInfo>(memberKeys.me())?.profileImageUrl).toBe(PHOTO)
    expect(client.getQueryData<MemberMyInfo>(memberKeys.header())?.profileImageUrl).toBe(PHOTO)
  })

  it('부분 갱신은 비어 있는 사본을 만들지 않는다 — 둘 다 비면 false', () => {
    const client = new QueryClient()

    expect(setMyInfo(client, (current) => current)).toBe(false)
    expect(client.getQueryData(memberKeys.header())).toBeUndefined()
  })

  it('전체 응답(닉네임 수정 · 사진 삭제)은 두 사본에 그대로 넣는다', () => {
    const client = new QueryClient()
    client.setQueryData(memberKeys.header(), member({ profileImageUrl: PHOTO }))

    replaceMyInfo(client, member({ nickname: '새닉네임' }))

    expect(client.getQueryData<MemberMyInfo>(memberKeys.me())?.nickname).toBe('새닉네임')
    expect(client.getQueryData<MemberMyInfo>(memberKeys.header())?.profileImageUrl).toBeNull()
  })
})
