import Link from 'next/link'

import { BookmarkIcon, ChevronRightIcon } from '@/components/icons'
import { MAX_FAVORITE_COUNT } from '@/lib/api/favorite'
import { messages } from '@/lib/messages'

/**
 * `저장한 장소` 행 — 마이페이지의 모바일 진입점 (#127).
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
export function MyFavoritesRow({ totalCount }: { totalCount: number | null }) {
  return (
    <Link
      href="/favorites"
      className="hover:bg-band focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:px-10"
    >
      <span className="bg-band text-fg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
        <BookmarkIcon size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-body-1 text-fg block font-semibold">
          {messages.favorite.entryLabel}
        </span>

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
      </span>

      <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
    </Link>
  )
}
