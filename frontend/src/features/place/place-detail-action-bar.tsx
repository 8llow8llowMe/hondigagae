'use client'

import { FormAlert } from '@/components/form-alert'
import { BookmarkIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type PlaceDetailActions = {
  authed: boolean
  saved: boolean
  savePending: boolean
  /** 저장 실패 문구. 하단 바 **위에** 남긴다 — 토스트로 흘리면 놓친다 */
  saveError: string | null
  onToggleSave: () => void
  /** 이 화면에서 한 번이라도 담았다 */
  added: boolean
  onAddToPlan: () => void
  /** 미로그인의 `로그인` 버튼. 로그인 안내 시트를 연다 */
  onLogin: () => void
  /**
   * 원천에서 사라진 장소인가 (#146). **두 동작이 서버에서 확정적으로 400 이다** —
   * 담기는 `PLAN_004`, 저장은 `FAVORITE_001`.
   *
   * 즐겨찾기 100곳 상한은 서버 오류에 맡겼는데 여기는 미리 막는다. 갈림길은 **화면이 이미
   * 그 사실을 갖고 있는가** 다 — 상한은 목록 전량을 받아야 알지만, `delisted` 는 지금 그리고
   * 있는 상세 응답에 실려 왔다. 알면서 400 을 맞게 두지 않는다.
   */
  delisted: boolean
}

/**
 * 장소 상세 하단 바 — 아트보드 `혼디가개 장소 상세` 01(모바일) · 03(데스크톱 레일) · 04 ③(미로그인).
 *
 * **네 개를 넣지 않는다.** 아트보드가 이유를 못박았다: "담기가 주요 액션이고 저장(즐겨찾기)은
 * 아이콘. 전화·길찾기는 기본 정보 안에 둔다 — 하단 바에 네 개를 넣으면 담기가 묻힌다."
 * 전화는 이미 기본 정보에 있고, 길찾기는 지도([#14](https://github.com/8llow8llowMe/hondigagae/issues/14)) 몫이다.
 *
 * **담은 뒤 라벨이 바뀐다** (`다른 일정에도 담기`). 같은 버튼이 그대로면 같은 자리에서
 * 두 번 눌러 같은 일정에 중복으로 담는다 (아트보드 02-C).
 *
 * **미로그인은 저장 아이콘 대신 `로그인` 버튼이다** (아트보드 04 ③ — 동폭 두 버튼).
 * 저장 여부를 알 수 없는데 빈 북마크를 두면 "저장 안 됨" 으로 읽힌다.
 *
 * **`delisted` 면 담기와 저장을 잠근다** (#146). 다만 **`저장 해제`는 잠그지 않는다** —
 * `DELETE /favorites/places/{placeId}` 는 장소 가시성을 보지 않아 정상 동작한다. 예전에
 * 저장해 둔 곳을 지울 길이 막히면 그게 더 나쁘다.
 *
 * **두 자리에 서고 인셋이 갈린다** (#443). 데스크톱은 판정 카드의 끝(L1 안, `card` 16/20),
 * 모바일은 뷰포트 바닥에 붙는 sticky 띠(`panel` 16)다. 담는 곳이 인셋을 정한다 (`inset.ts`).
 * **배경도 sticky 갈래만 갖는다** — 카드 안 자식은 자기 배경을 갖지 않는다 (§0). sticky 띠는
 * 본문 위를 지나가므로 불투명해야 하고, 그쪽 호출자가 `bg-bg` 를 `className` 으로 준다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 */
export function PlaceDetailActionBar({
  authed,
  saved,
  savePending,
  saveError,
  onToggleSave,
  added,
  onAddToPlan,
  onLogin,
  delisted,
  inset = 'panel',
  className,
}: PlaceDetailActions & {
  /** 좌우 인셋 — 카드 안이면 `card`, sticky 띠면 `panel`(기본) */
  inset?: Inset
  className?: string
}) {
  // 해제는 살려 둔다 — 잠기는 것은 **새로 저장하는 방향**뿐이다
  const saveBlocked = delisted && !saved

  return (
    <div className={cn('border-border border-t', className)}>
      {saveError !== null && (
        <div className={cn('pt-3', INSET_CLASS[inset])}>
          <FormAlert message={saveError} />
        </div>
      )}

      {/*
        왜 잠겼는지 **버튼 위에** 남긴다. `disabled` 만 걸면 스크린리더도 마우스도 이유를
        얻지 못하고, 토스트로 흘리면 눌러 본 사람만 본다.
      */}
      {delisted && (
        <p className={cn('text-body-2 text-fg-muted pt-3', INSET_CLASS[inset])}>
          {messages.place.detailDelistedActionsBlocked}
        </p>
      )}

      <div className={cn('flex gap-2 py-3', INSET_CLASS[inset])}>
        {authed ? (
          /*
            아이콘 버튼이라 이름이 `aria-label` 에만 있다. **누른 상태를 `aria-pressed` 로
            말한다** — 아이콘 채움만으로는 스크린리더가 저장 여부를 알 수 없다.
            라벨도 하는 일에 따라 뒤집는다 (`저장` ↔ `저장 해제`) — 아트보드가 그렇게 적었다.
          */
          <button
            type="button"
            onClick={onToggleSave}
            disabled={savePending || saveBlocked}
            aria-pressed={saved}
            aria-label={saved ? messages.favorite.unsave : messages.favorite.save}
            className={cn(
              'border-border-strong focus-visible:ring-brand-500 flex size-13 shrink-0 items-center justify-center rounded-md border focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 lg:size-12',
              saved ? 'bg-band' : 'bg-bg',
            )}
          >
            <BookmarkIcon size={22} fill={saved ? 'currentColor' : 'none'} className="text-fg" />
          </button>
        ) : (
          <button type="button" onClick={onLogin} className={cn(SHARED, SECONDARY, 'flex-1')}>
            {messages.plan.addToPlanLoginAction}
          </button>
        )}

        <button
          type="button"
          onClick={onAddToPlan}
          disabled={delisted}
          className={cn(
            SHARED,
            added ? SECONDARY : PRIMARY,
            'flex-1 disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {added ? messages.plan.addToPlanAgainAction : messages.plan.addToPlanAction}
        </button>
      </div>
    </div>
  )
}

/*
  `Button` 을 쓰지 않는다 — 하단 바의 높이(모바일 52 / 데스크톱 48)가 `size` 열거에 없고,
  컴포넌트 `className` 으로 외형을 덮는 것은 금지돼 있다 (component-guide.md §3).
*/
const SHARED =
  'text-body-1 focus-visible:ring-brand-500 h-13 rounded-md font-semibold focus-visible:ring-2 focus-visible:outline-none lg:h-12'
const PRIMARY = 'bg-brand-600 hover:bg-brand-700 text-fg-inverse'
const SECONDARY = 'border-border-strong text-fg bg-bg border'
