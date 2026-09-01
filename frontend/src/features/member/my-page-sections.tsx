import Link from 'next/link'

import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { Band, Section } from '@/components/surface'
import { AccountSection } from '@/features/member/account-section'
import { MyFavoritesRow } from '@/features/member/my-favorites-row'
import { MyPetsRow } from '@/features/member/my-pets-row'
import { MyProfileSection } from '@/features/member/my-profile-section'
import { toAccountState } from '@/lib/member/account-state'
import { messages } from '@/lib/messages'
import type { MemberMyInfo } from '@/types/member'
import type { Pet } from '@/types/pet'

export type MyPageSectionsProps = {
  member: MemberMyInfo | null
  loading: boolean
  /** 회원 정보 조회 실패의 HTTP 상태. 성공했으면 null */
  errorStatus: number | null
  /**
   * **`null` 은 "조회 실패" 다** — 빈 배열(0마리)과 다르다. 실패면 행을 통째로 숨기고,
   * 0마리면 행은 남기고 문구만 바꾼다 (D5). 두 경우를 `[]` 하나로 합치면 실패가
   * "반려견 없음" 으로 잘못 읽힌다.
   */
  pets: Pet[] | null
  petsLoading: boolean
  petsTotalCount: number
  /**
   * 저장한 장소 개수 (#127). **`null` 은 조회 실패**이고, 그때는 개수 줄만 빠지고
   * 진입점 자체는 남는다 — 목록이 안 열리는 것과 진입점이 사라지는 것은 다른 일이다.
   */
  favoritesTotalCount: number | null
  favoritesLoading: boolean
  onRetry: () => void
  onLogout: () => void
  onEditProfile: () => void
}

/**
 * 표시 전용. 조회 상태는 `MyPageView` 가 props 로 변환해 넘긴다
 * — `PetListSection` 과 같은 구조이고, 이 분리가 렌더 테스트를 가능하게 한다
 * (docs/testing-guide.md §1).
 *
 * 블록 순서: 내 정보 → **내 반려견 · 저장한 장소** → 계정 → 위험한 액션 (아트보드 01).
 *
 * 저장한 장소는 반려견과 같은 밴드 안에 둔다 (#127) — 둘 다 "내가 쌓아 둔 것" 이고,
 * 밴드를 하나 더 끼우면 "여기서 다른 이야기가 시작된다" 는 신호가 닳는다
 * (`surface.tsx` 의 `Band` 주석).
 */
export function MyPageSections({
  member,
  loading,
  errorStatus,
  pets,
  petsLoading,
  petsTotalCount,
  favoritesTotalCount,
  favoritesLoading,
  onRetry,
  onLogout,
  onEditProfile,
}: MyPageSectionsProps) {
  if (loading) {
    return (
      <div aria-hidden className="flex flex-col gap-3 px-4 py-5 md:px-10">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  // 404 가 나올 수 없는 리소스다 — `/members/me` 는 항상 존재한다.
  // 남는 것은 일시 장애뿐이라 재시도를 준다
  if (errorStatus !== null || member === null) {
    return (
      <ErrorState
        title={messages.member.loadFailedTitle}
        description={messages.member.loadFailedDescription}
        onRetry={onRetry}
      />
    )
  }

  return (
    <>
      <Section>
        <MyProfileSection
          member={member}
          trailing={
            /*
              `수정` 은 이동이 아니라 모달을 여는 **동작**이라 `<a>` 가 아니라 `<button>`
              이다 (D6). 아트보드 01 은 `14/600` 브랜드 색 텍스트다 — 채움 버튼이 아니다.
            */
            <button
              type="button"
              onClick={onEditProfile}
              className="text-body-2 text-brand-600 focus-visible:ring-brand-500 flex min-h-11 shrink-0 items-center px-1 font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {messages.member.edit}
            </button>
          }
        />
      </Section>

      <Band />

      {petsLoading ? (
        <Skeleton className="mx-4 my-3 h-14 md:mx-10" />
      ) : (
        // 조회 실패면 이 행만 빠지고 나머지는 그대로 보인다 (D5)
        pets !== null && <MyPetsRow pets={pets} totalCount={petsTotalCount} />
      )}

      {favoritesLoading ? (
        <Skeleton className="mx-4 my-3 h-14 md:mx-10" />
      ) : (
        <MyFavoritesRow totalCount={favoritesTotalCount} />
      )}

      <Band />

      <AccountSection state={toAccountState(member)} provider={member.provider} />

      <Band />

      {/*
        위험한 액션은 마지막에, 약하게 — 아트보드 01 주석.
        로그아웃 16/600, 회원탈퇴 14/500 `--fg-muted`. **둘 다 danger 색을 쓰지 않는다**:
        실수를 막는 건 색이 아니라 위치와 확인 단계다.

        로그아웃은 **동작**이라 `<button>`, 회원탈퇴는 **이동**이라 `<a>` 다.
        모양이 비슷해도 역할이 다르다 (D6).
      */}
      <div className="flex flex-col items-start px-4 py-2 md:px-10">
        <button
          type="button"
          onClick={onLogout}
          className="text-body-1 text-fg focus-visible:ring-brand-500 flex min-h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.member.logout}
        </button>

        <Link
          href="/mypage/withdraw"
          className="text-body-2 text-fg-muted focus-visible:ring-brand-500 flex min-h-11 items-center font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.member.withdraw}
        </Link>
      </div>
    </>
  )
}
