import Link from 'next/link'

import { BookmarkIcon, ChevronRightIcon } from '@/components/icons'
import { MAX_FAVORITE_COUNT } from '@/lib/api/favorite'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'

/**
 * `저장한 장소` 행 — 마이페이지의 모바일 진입점 (#127).
 *
 * **L1 카드 안의 L2 항목이다** (`DESIGN.md §0`, 이슈 #466) — `MyPetsRow` 와 같은 카드에
 * 들어간다. 2a 때 둘을 같은 밴드에 둔 이유("둘 다 내가 쌓아 둔 것")를 카드 경계가
 * 그대로 옮겼다.
 *
 * 아트보드 `혼디가개 저장한 장소` 가 진입점을 "모바일: 내 정보 탭 · 데스크톱: 아바타
 * 팝오버" 로 못박았다. 탭바는 4개 고정이라 (전역nav-세부명세 D4-1) 늘리지 않고,
 * 데스크톱은 `ACCOUNT_MENU_ITEMS` 가 맡는다.
 *
 * **개수를 보여 준다.** `내 반려견` 행이 이름을 늘어놓는 것과 같은 이유다 — 들어가기 전에
 * 안이 비었는지 알 수 있어야 헛걸음이 줄어든다.
 *
 * **조회 실패면 개수 대신 라벨만 남는다.** 진입점을 없애지 않는다 — 목록이 안 열리는 것과
 * 진입점이 사라지는 것은 다른 일이고, 들어가면 그쪽 화면이 오류를 제대로 말한다 (D5).
 *
 * 이동이므로 `<a>` 다 (D6).
 */
export function MyFavoritesRow({
  totalCount,
  inset = 'card',
}: {
  totalCount: number | null
  inset?: Inset
}) {
  return (
    <li className={INSET_CLASS[inset]}>
      <Link
        href="/favorites"
        className="focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
      >
        {/*
          아이콘 채움은 `--band` 다. 카드 모서리에 닿지 않는 원형이라 radius 를 덮지
          않는다 — 금지되는 것은 카드 폭을 채우는 각진 면이다 (§0).
        */}
        <span className="bg-band text-fg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
          <BookmarkIcon size={20} />
        </span>

        {/* `h3` 는 flow content 라 `span` 안에 들 수 없다 — `PetRow` 와 같이 `div` 다 */}
        <div className="min-w-0 flex-1">
          {/* `MyPetsRow` 와 같은 레벨이다 — 카드 안 항목은 `h3` */}
          <h3 className="text-body-1 text-fg block font-semibold">
            {messages.favorite.entryLabel}
          </h3>

          {/* null = 조회 실패. 0 = 저장한 곳이 없음. 둘을 같은 문구로 뭉개지 않는다 */}
          {totalCount !== null && (
            <span className="text-body-2 text-fg-muted block truncate tabular-nums">
              {totalCount === 0
                ? messages.favorite.entryEmpty
                : messages.favorite.countOfMax
                    .replace('{count}', String(totalCount))
                    .replace('{max}', String(MAX_FAVORITE_COUNT))}
            </span>
          )}
        </div>

        <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
      </Link>
    </li>
  )
}
