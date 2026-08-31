'use client'

import { FormAlert } from '@/components/form-alert'
import { BookmarkIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
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
  className,
}: PlaceDetailActions & { className?: string }) {
  return (
    <div className={cn('border-border bg-bg border-t', className)}>
      {saveError !== null && (
        <div className="px-4 pt-3 lg:px-6">
          <FormAlert message={saveError} />
        </div>
      )}

      <div className="flex gap-2 px-4 py-3 lg:px-6">
        {authed ? (
          /*
            아이콘 버튼이라 이름이 `aria-label` 에만 있다. **누른 상태를 `aria-pressed` 로
            말한다** — 아이콘 채움만으로는 스크린리더가 저장 여부를 알 수 없다.
            라벨도 하는 일에 따라 뒤집는다 (`저장` ↔ `저장 해제`) — 아트보드가 그렇게 적었다.
          */
          <button
            type="button"
            onClick={onToggleSave}
            disabled={savePending}
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
          className={cn(SHARED, added ? SECONDARY : PRIMARY, 'flex-1')}
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
