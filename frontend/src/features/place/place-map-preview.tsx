'use client'

import { useEffect, useRef, useState } from 'react'

import { usePlaceFavorite } from '@/features/favorite/use-place-favorite'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import { PlaceLoginPromptSheet } from '@/features/place/place-login-prompt-sheet'
import {
  PlaceMapPreviewBody,
  type PlaceMapPreviewVariant,
} from '@/features/place/place-map-preview-body'
import { usePlaceDetail } from '@/features/place/use-place-detail'
import { usePlaceSuitability } from '@/features/place/use-place-suitability'
import { usePlaceWalkSafety } from '@/features/place/use-place-walk-safety'
import { PlaceAddToPlanSheet } from '@/features/plan/place-add-to-plan-sheet'
import { toPetCondition } from '@/lib/api/insight'
import type { PlaceSummary } from '@/types/place'

/**
 * 지도 보기의 장소 미리보기 (#1227) — "갈 만한가" 를 상세로 가지 않고 판단하게 한다.
 * 무엇을 그리는지는 `PlaceMapPreviewBody` 가 갖는다. 여기는 **조회 · 상태 · 포커스**만 쥔다.
 *
 * **조회 key 는 상세 화면과 같다** (`placeKeys.detail` · `insightKeys.*` + 같은 반려견 조건).
 * 미리보기에서 받은 값이 `상세 보기` 로 넘어가면 그대로 쓰여, 첫 화면이 캐시로 바로 뜬다.
 * **이 컴포넌트가 마운트될 때만 조회한다** — 고르지 않은 행 · 마우스를 올린 행은 부르지 않는다.
 *
 * 부모가 `key={placeId}` 로 마운트한다 — 장소를 바꾸면 `담았다` · 시트 상태가 새로 시작한다.
 */
export function PlaceMapPreview({
  placeId,
  summary,
  authed,
  variant,
  onClose,
}: {
  placeId: string
  summary: PlaceSummary | null
  authed: boolean
  variant: PlaceMapPreviewVariant
  onClose: () => void
}) {
  const detail = usePlaceDetail(placeId)

  // 상세 화면과 같은 두 호출이다 — 조건이 같아야 key 가 겹친다 (`place-detail-view.tsx`)
  const { pet } = useSelectedPet(authed)
  const condition = toPetCondition(pet)
  const suitability = usePlaceSuitability(placeId, condition)
  const walkSafety = usePlaceWalkSafety(placeId, condition)

  const favorite = usePlaceFavorite({ placeId, authed })
  const [addOpen, setAddOpen] = useState(false)
  const [loginIntent, setLoginIntent] = useState<'add' | 'save' | null>(null)
  const [added, setAdded] = useState(false)

  const title = summary?.title ?? detail.data?.title ?? null

  /*
    **포커스를 잃었으면 이름으로 데려온다.** 1024~1279 는 미리보기가 목록 자리를 쓰고(목록은
    `invisible`), 모바일은 목록 시트가 `hidden` 이 된다 — 키보드로 행을 고른 사람의 포커스가 사라진
    요소에 남아 다음 Tab 이 어디로 갈지 모른다(WCAG 2.4.3). 1280 부터는 행이 그대로 보이므로
    **빼앗지 않는다** — 목록을 훑어 내려가는 중이다. 그래서 폭이 아니라 "지금 포커스가 보이는가" 로 가른다.
  */
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusedRef = useRef(false)
  useEffect(() => {
    if (focusedRef.current || headingRef.current === null) return
    // 이름이 서기 전(공유 링크 · 상세 대기)에는 다음 렌더에 다시 본다
    focusedRef.current = true
    const active = document.activeElement
    const lost =
      active instanceof HTMLElement &&
      active !== document.body &&
      (active.getClientRects().length === 0 || getComputedStyle(active).visibility === 'hidden')
    // 보이는 쪽(데스크톱 패널 · 모바일 시트) 하나만 가져간다 — 숨겨진 쪽 이름은 크기가 0 이다
    if (lost && headingRef.current.getClientRects().length > 0) headingRef.current.focus()
  }, [title])

  return (
    <>
      <PlaceMapPreviewBody
        placeId={placeId}
        variant={variant}
        onClose={onClose}
        summary={summary}
        detail={{
          data: detail.data ?? null,
          loading: detail.isPending,
          failed: detail.isError,
        }}
        suitability={{
          data: suitability.data ?? null,
          loading: suitability.isPending,
          failed: suitability.isError,
        }}
        walkSafety={{
          data: walkSafety.data ?? null,
          loading: walkSafety.isPending,
          failed: walkSafety.isError,
        }}
        petName={pet?.name ?? null}
        actions={{
          authed,
          saved: favorite.saved,
          savePending: favorite.pending || favorite.loading,
          saveError: favorite.error,
          onToggleSave: () => (authed ? favorite.toggle() : setLoginIntent('save')),
          added,
          onAddToPlan: () => (authed ? setAddOpen(true) : setLoginIntent('add')),
          onLogin: () => setLoginIntent('add'),
          delisted: detail.data?.delisted ?? false,
        }}
        headingRef={headingRef}
      />

      {title !== null && (
        <>
          <PlaceAddToPlanSheet
            open={addOpen}
            onClose={() => setAddOpen(false)}
            place={{ placeId, title }}
            onAdded={() => setAdded(true)}
          />
          {/* 로그인 뒤에는 상세로 돌아간다 (`returnTo` 가 상세 고정) — 담으려던 장소는 기억된다 */}
          <PlaceLoginPromptSheet
            open={loginIntent !== null}
            onClose={() => setLoginIntent(null)}
            intent={loginIntent ?? 'add'}
            place={{ placeId, title }}
          />
        </>
      )}
    </>
  )
}
