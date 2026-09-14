'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { usePlaceFavorite } from '@/features/favorite/use-place-favorite'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import { PlaceDetailSection } from '@/features/place/place-detail-section'
import { PlaceLoginPromptSheet } from '@/features/place/place-login-prompt-sheet'
import { usePlaceCongestion } from '@/features/place/use-place-congestion'
import { usePlaceDetail } from '@/features/place/use-place-detail'
import { usePlaceSuitability } from '@/features/place/use-place-suitability'
import { usePlaceWalkSafety } from '@/features/place/use-place-walk-safety'
import { PlaceAddToPlanSheet } from '@/features/plan/place-add-to-plan-sheet'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { toPetCondition } from '@/lib/api/insight'
import { CONGESTION_DAYS, type CongestionDays } from '@/lib/insight/congestion'
import { writeRecentPlaceId } from '@/lib/insight/recent-place'

/**
 * 로그인 후 돌아왔을 때 담기 시트를 다시 열라는 표시 (아트보드 04 ④).
 *
 * **URL 에 둔다.** 로그인은 화면을 통째로 갈아 끼우므로 메모리 상태로는 넘길 수 없고,
 * `returnTo` 가 경로 문자열이라 쿼리에 실으면 그대로 돌아온다.
 */
const RESUME_ADD_PARAM = 'add'

/** 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다 */
export function PlaceDetailView({ placeId, authed }: { placeId: string; authed: boolean }) {
  const query = usePlaceDetail(placeId)

  /**
   * 판정은 **선택된 반려견 기준**이다. 헤더 스위처에서 바꾸면 조건이 바뀌고 key 가 달라져
   * 재조회된다 — 목록 필터의 크기 축과 같은 스토어를 쓴다.
   *
   * **미로그인이면 두 조회가 갈린다** (#200).
   *  - 반려견 목록: **조회하지 않는다.** 보호 리소스라 403 이 된다 → `pet` 은 null 이다
   *  - 적합도: **조회한다.** 인사이트는 공개 API 라 조건 없이 부르면 일반 판정이 온다
   *
   * 그 응답의 날씨만 게스트 블록이 쓰고 **점수·근거는 쓰지 않는다** — 기준이 되는
   * 반려견이 없다.
   */
  const { pet } = useSelectedPet(authed)
  const condition = toPetCondition(pet)
  const suitability = usePlaceSuitability(placeId, condition)

  /*
    산책 위험도 (#197). **적합도와 같은 조건을 쓰되 별도 query 다** — 엔드포인트가 다르고
    한쪽만 실패할 수 있다. 조건을 한 번만 만들어 둘에 넘기는 이유는 두 key 가 같은
    `conditionKey` 로 갈려야 반려견 전환이 두 판정에 동시에 반영되기 때문이다.
  */
  const walkSafety = usePlaceWalkSafety(placeId, condition)

  /*
    기간 혼잡도 (#430). **반려견 조건을 넘기지 않는다** — 붐빔은 장소와 날짜의 속성이라
    반려견이 바뀌어도 같은 답이고, 서버도 이 경로에서는 조건 파라미터를 선언하지 않는다.

    **기간은 이 화면 안에서 끝나는 상태다** (`useState`, architecture-guide.md §10). 카드
    하나의 펼침이라 링크로 공유할 대상이 아니다 — `/places/{id}` 를 받은 사람이 봐야 하는
    것은 그 장소이지 내가 펼쳐 둔 30일이 아니다.
  */
  const [congestionDays, setCongestionDays] = useState<CongestionDays>(CONGESTION_DAYS.default)
  const congestion = usePlaceCongestion(placeId, congestionDays)

  const favorite = usePlaceFavorite({ placeId, authed })

  const [addOpen, setAddOpen] = useState(false)
  const [loginIntent, setLoginIntent] = useState<'add' | 'save' | null>(null)
  /** 이 화면에서 한 번이라도 담았다. 하단 바 라벨이 `다른 일정에도 담기` 로 바뀐다 */
  const [added, setAdded] = useState(false)

  /**
   * 홈의 산책 판정이 쓸 **기준 장소**를 남긴다 (공통명세 S5-1).
   *
   * 조회에 성공했을 때만 기록한다 — 404 인 placeId 를 남기면 홈이 없는 장소로 판정을
   * 조회해 그 섹션이 매번 실패한다.
   */
  useEffect(() => {
    if (query.data !== undefined) writeRecentPlaceId(placeId)
  }, [placeId, query.data])

  useResumeAddSheet({ authed, setOpen: setAddOpen })

  const title = query.data?.title ?? ''

  return (
    <>
      <PlaceDetailSection
        place={query.data ?? null}
        loading={query.isPending}
        errorStatus={toErrorStatus(query.error)}
        errorMessage={query.error instanceof ApiError ? query.error.rawMessage : undefined}
        onRetry={() => void query.refetch()}
        // 장소 조회와 판정 조회는 **따로 실패한다.** 판정이 죽어도 기본 정보는 그대로 쓸모가 있다
        suitability={{
          data: suitability.data ?? null,
          loading: suitability.isPending,
          failed: suitability.isError,
          onRetry: () => void suitability.refetch(),
          petName: pet?.name ?? null,
          authed,
        }}
        /*
          산책 위험도는 **게스트에게도 그린다** — 적합도가 `GuestBlock` 으로 갈리는 것과
          다르다. 노면 온도·열지수는 장소와 시각의 속성이라 반려견이 없어도 값이 참이고,
          홈의 `WalkVerdict` 도 같게 군다 (`place-walk-safety-panel.tsx`).
        */
        walkSafety={{
          data: walkSafety.data ?? null,
          loading: walkSafety.isPending,
          failed: walkSafety.isError,
          onRetry: () => void walkSafety.refetch(),
          petName: pet?.name ?? null,
        }}
        /*
          기간 혼잡도는 **게스트에게도 그린다** — 산책 위험도와 같다. 붐빔은 장소와 날짜의
          속성이라 반려견이 없어도 값이 참이고, 반려견을 고르라고 막을 이유가 없다.
        */
        congestion={{
          data: congestion.data ?? null,
          loading: congestion.isPending,
          failed: congestion.isError,
          onRetry: () => void congestion.refetch(),
          days: congestionDays,
          onDaysChange: setCongestionDays,
        }}
        petName={pet?.name ?? null}
        petSizeCode={pet?.sizeType.code ?? null}
        petSizeName={pet?.sizeType.name ?? null}
        actions={{
          authed,
          saved: favorite.saved,
          savePending: favorite.pending || favorite.loading,
          saveError: favorite.error,
          onToggleSave: () => (authed ? favorite.toggle() : setLoginIntent('save')),
          added,
          onAddToPlan: () => (authed ? setAddOpen(true) : setLoginIntent('add')),
          onLogin: () => setLoginIntent('add'),
          /*
            아직 못 받았으면 `false` 다 — 잠긴 바를 먼저 보여 주고 푸는 것보다 낫다.
            조회 중에는 스켈레톤이라 이 값이 화면에 닿지도 않는다 (#146).
          */
          delisted: query.data?.delisted ?? false,
        }}
      />

      {/* 장소를 아직 못 받았으면 열지 않는다 — 시트가 제목으로 무엇을 담는지 말한다 */}
      {query.data !== undefined && (
        <PlaceAddToPlanSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          place={{ placeId, title }}
          onAdded={() => setAdded(true)}
        />
      )}

      <PlaceLoginPromptSheet
        open={loginIntent !== null}
        onClose={() => setLoginIntent(null)}
        intent={loginIntent ?? 'add'}
        place={{ placeId, title }}
      />
    </>
  )
}

/**
 * 로그인하고 돌아왔으면 담기 시트를 다시 연다 (아트보드 04 ④ — "담으려던 장소를
 * 기억하지 못하면 이탈한다").
 *
 * **연 뒤에 쿼리를 지운다.** 남겨 두면 새로고침·뒤로가기마다 시트가 다시 열리고,
 * 그 URL 을 공유하면 남의 화면에서도 열린다.
 *
 * **미로그인이면 열지 않는다.** 주소를 손으로 만들어 들어오면 로그인 안내 시트를 다시
 * 띄우는 고리가 된다 — 표시만 지우고 끝낸다.
 */
function useResumeAddSheet({
  authed,
  /** `useState` 의 setter 라 참조가 안정적이다 — 매 렌더 새로 만든 콜백을 받으면 고리가 된다 */
  setOpen,
}: {
  authed: boolean
  setOpen: (open: boolean) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const resume = searchParams.get(RESUME_ADD_PARAM) === '1'

  useEffect(() => {
    if (!resume) return

    if (authed) setOpen(true)

    const next = new URLSearchParams(searchParams)
    next.delete(RESUME_ADD_PARAM)
    const query = next.toString()
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false })
  }, [resume, authed, pathname, router, searchParams, setOpen])
}
