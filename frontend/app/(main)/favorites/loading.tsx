import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceList, SurfaceStack } from '@/components/surface'
import {
  FAVORITE_SKELETON_COUNT,
  FavoriteRowSkeleton,
} from '@/features/favorite/favorite-row-skeleton'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 최초 진입 로딩. 섹션 내부 재조회 로딩은 `FavoriteListSection` 이 담당한다.
 *
 * **실화면과 같은 층으로 그린다** (`DESIGN.md §0`) — L0 바닥 위에 L1 카드 하나다.
 * 예전에는 흰 페이지에 `rounded-lg` 카드 세 장을 늘어놓아, 로딩이 끝나는 순간 바닥색과
 * 카드 경계가 동시에 생기며 화면이 한 번 뒤집혔다 (장소 목록 #439 와 같은 수정).
 *
 * **`main` 이자 `h1` 이다.** `(main)/layout.tsx` 는 `div#main` 만 주므로 `main` 랜드마크를
 * 내는 것은 페이지뿐이다 — 폴백이 떠 있는 동안 랜드마크가 0개가 되면 안 된다.
 *
 * **제목 자리도 카드 안이다.** 목록의 제목이 카드 제목으로 들어갔기 때문이다 —
 * 밖에 두면 로딩 중에만 제목이 카드 위에 뜬다.
 *
 * 머리 스켈레톤은 **실제 제목 크기를 따른다** — 모바일 `title-2`(26) / md `display`(36).
 * `Surface` 의 부제 간격도 `mt-1` 이라 여기서 `mt-2` 를 쓰면 로딩이 끝날 때 머리가 튄다.
 */
export default function FavoritesLoading() {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.favorite.listTitle}</h1>

        <Surface>
          <div className={cn('pt-5 pb-3', INSET_CLASS.card)}>
            <Skeleton variant="text" className="h-6 w-40 md:h-9" />
            <Skeleton variant="text" className="mt-1 h-5 w-48" />
          </div>

          <SurfaceList columns={2} aria-busy>
            {Array.from({ length: FAVORITE_SKELETON_COUNT }, (_, index) => (
              <FavoriteRowSkeleton key={index} />
            ))}
          </SurfaceList>
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
