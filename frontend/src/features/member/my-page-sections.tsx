import Link from 'next/link'

import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { Surface, SurfaceList } from '@/components/surface'
import { AccountSection } from '@/features/member/account-section'
import { MyFavoritesRow } from '@/features/member/my-favorites-row'
import { MyPetsRow } from '@/features/member/my-pets-row'
import { MyProfileSection } from '@/features/member/my-profile-section'
import { toAccountState } from '@/lib/member/account-state'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { MemberMyInfo } from '@/types/member'
import type { Pet } from '@/types/pet'

export type MyPageSectionsProps = {
  member: MemberMyInfo | null
  loading: boolean
  /** 회원 정보 조회 실패의 HTTP 상태. 성공했으면 null */
  errorStatus: number | null
  /**
   * **`null` 은 "조회 실패" 다** — 빈 배열(0마리)과 다르다. 실패면 항목을 통째로 숨기고,
   * 0마리면 항목은 남기고 문구만 바꾼다 (D5). 두 경우를 `[]` 하나로 합치면 실패가
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
 * ### 3층 표면에서 카드가 둘이다 (`DESIGN.md §0`, 이슈 #466)
 *
 * | 카드 | 담는 것 | 이야기 |
 * | ---- | ------- | ------ |
 * | `내 정보` (`lead`) | 프로필 · 내 반려견 · 저장한 장소 | **내 것** |
 * | `계정` | 소셜 연결 · 비밀번호 · 버전 | **설정** |
 *
 * 2a 의 밴드 경계는 셋이었다. **프로필을 따로 떼지 않는다** — 혼자서는 자기 제목이 없고
 * 담는 항목도 하나라 카드 판정 ①③ 에 걸린다. 홈이 프로필·판정·골든타임을 카드 하나에
 * 담은 것과 같은 판단이고(#428), 2a 주석이 "저장한 장소는 반려견과 같은 밴드"라고 적어
 * 둔 이유("둘 다 내가 쌓아 둔 것")를 프로필까지 넓힌 것이다.
 *
 * **`lead` 는 첫 카드가 갖는다.** `DESIGN.md §3-1` 의 "화면의 주인공 섹션" 이고, 이
 * 화면에서 사람이 보러 오는 것은 계정 설정이 아니라 자기 정보다.
 *
 * **네 상태가 카드 머리를 공유한다** (#451 · #440 · #462). 로딩·오류에서도 제목 줄은
 * 그대로 서 있고 몸통만 갈린다 — 제목까지 스켈레톤으로 지우면 조회가 끝나는 순간 카드
 * 높이와 경계가 함께 뛴다.
 *
 * **로그아웃·회원탈퇴는 카드가 아니다** — 액션은 카드 판정에서 빠진다(§0). L0 바닥 위에
 * 그대로 선다 (반려견 삭제 #464 · 일정 만들기 취소 #453 과 같은 자리).
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
  /*
    404 가 나올 수 없는 리소스다 — `/members/me` 는 항상 존재한다. 남는 것은 일시
    장애뿐이라 재시도를 준다.

    **술어가 하나여야 한다.** 카드 본문과 계정 카드 표시를 각각 `member === null` 과
    `errorStatus !== null` 로 판정하면 둘이 어긋나는 구간
    (`errorStatus !== null && member !== null` — 프리페치로 캐시가 찬 뒤 refetch 가 5xx
    로 실패하면 실제로 생긴다)에서 계정 카드만 말없이 사라지고 오류 문구도 재시도도
    나오지 않는다. 명세 D5 는 그 갈래를 `ErrorState` + 재시도 한 줄로 정해 두었다.
  */
  const failed = !loading && (errorStatus !== null || member === null)

  return (
    <>
      <Surface
        lead
        titleId="my-page-heading"
        title={messages.member.myPageTitle}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <div aria-hidden className={cn('flex flex-col gap-3 pb-5', INSET_CLASS.card)}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : failed || member === null ? (
          <ErrorState
            inset="card"
            title={messages.member.loadFailedTitle}
            description={messages.member.loadFailedDescription}
            onRetry={onRetry}
          />
        ) : (
          <>
            <MyProfileSection
              member={member}
              trailing={
                /*
                  `수정` 은 이동이 아니라 모달을 여는 **동작**이라 `<a>` 가 아니라
                  `<button>` 이다 (D6). 아트보드 01 은 `14/600` 브랜드 색 텍스트다 —
                  채움 버튼이 아니다.

                  **카드 머리의 `trailing` 이 아니라 프로필 줄에 붙어 있다.** 카드가
                  담는 셋 중 프로필만 고치는 동작이라, 머리로 올리면 반려견·저장한
                  장소까지 수정하는 것으로 읽힌다.
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

            {/*
              **위 선은 목록이 아니라 이 자리가 긋는다.** `SurfaceList` 는 항목 **사이에만**
              선을 그으므로(`[&>li+li]`) 프로필과 첫 항목 사이는 비어 있다 — 홈이 카드 안
              블록마다 자기 `border-t` 를 들고 있는 것과 같은 처리다(#428).
            */}
            <SurfaceList className="border-border border-t">
              {petsLoading ? (
                <li aria-hidden className={INSET_CLASS.card}>
                  <Skeleton className="my-3 h-14" />
                </li>
              ) : (
                // 조회 실패면 이 항목만 빠지고 나머지는 그대로 보인다 (D5)
                pets !== null && <MyPetsRow pets={pets} totalCount={petsTotalCount} />
              )}

              {favoritesLoading ? (
                <li aria-hidden className={INSET_CLASS.card}>
                  <Skeleton className="my-3 h-14" />
                </li>
              ) : (
                <MyFavoritesRow totalCount={favoritesTotalCount} />
              )}
            </SurfaceList>
          </>
        )}
      </Surface>

      {/*
        **조회 실패면 계정 카드를 내지 않는다.** 소셜 연결 여부·비밀번호 유무가 전부
        회원 정보에서 오므로, 값 없이 그리면 "일반 계정" 을 단정하게 된다 (D5).
        재시도는 위 카드가 이미 갖고 있다.

        **카드를 여기서 그린다.** 제목 `계정` 이 응답과 무관한 정적 값이라
        `styling-guide.md §3-1` 의 기준("머리 값이 응답에서 오면 섹션이, 정적이면
        페이지가")에 걸린다 — `AccountSection` 은 카드 안 내용만 낸다.
      */}
      {!failed && (
        <Surface
          titleId="account-heading"
          title={messages.member.accountSection}
          aria-busy={loading || undefined}
        >
          {loading || member === null ? (
            /*
              **높이를 실제 카드에 맞춘다.** 계정 카드의 실제 몸통은 행이 각자 `py-3` 을
              든 `min-h-14` 둘(=112)이고 카드 아래 여백이 없다. `gap-3 pb-5` 를 쓰면 144 가
              되어, 조회가 끝나는 순간 카드가 32px 줄며 아래가 통째로 뛴다 (390 실측).
            */
            <div aria-hidden className={cn('flex flex-col', INSET_CLASS.card)}>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <AccountSection state={toAccountState(member)} provider={member.provider} />
          )}
        </Surface>
      )}

      {/*
        위험한 액션은 마지막에, 약하게 — 아트보드 01 주석.
        로그아웃 16/600, 회원탈퇴 14/500 `--fg-muted`. **둘 다 danger 색을 쓰지 않는다**:
        실수를 막는 건 색이 아니라 위치와 확인 단계다.

        로그아웃은 **동작**이라 `<button>`, 회원탈퇴는 **이동**이라 `<a>` 다.
        모양이 비슷해도 역할이 다르다 (D6).

        **L0 바닥 위다** — 액션은 카드가 아니다(§0). 왼쪽 정렬은 아트보드 01 그대로
        두되 인셋을 `main`(16/40)이 아니라 **`card`(16/20)로 잡는다**: L0 위에 있어도
        축은 바로 위 카드 안 글줄과 같아야 `로그아웃` 의 첫 글자가 `비밀번호 변경` 과
        같은 세로선에 선다 (`plan-add-place-header` 의 `inset` 주석, #451). `main` 을
        쓰면 데스크톱에서 20px 계단이 생긴다.

        **정확히는 1px 왼쪽에 선다** (768에서 44 대 45, 1920에서 620 대 621 — 실측).
        `Surface` 가 `md:border` 를 쓰므로 카드의 padding box 가 border box 보다 1px
        안쪽인데 L0 블록에는 상쇄할 테두리가 없다. 모바일은 `border-y` 라 정확히 맞는다.
        눈으로 보이지 않아 그대로 둔다 — 다음 사람이 다시 재지 않게 적어 둔다.

        **로딩·오류에서는 내지 않는다.** 2a 는 두 상태에서 early return 이라 이 블록이
        아예 없었다 — 층을 옮기며 조건 밖으로 새어 나가면, 라우트 스켈레톤
        (`loading.tsx`, 액션 없음)에서 클라이언트 로딩으로 넘어가는 순간 버튼 둘이
        튀어나온다. 리팩토링이라 동작을 그대로 둔다.
      */}
      {!loading && !failed && (
        <div className={cn('flex flex-col items-start py-2', INSET_CLASS.card)}>
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
      )}
    </>
  )
}
