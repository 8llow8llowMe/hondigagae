import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceList, SurfaceStack } from '@/components/surface'
import { PlaceRowSkeleton } from '@/features/place/place-row-skeleton'

/**
 * 최초 진입 로딩. 섹션 내부 재조회 로딩은 `PlaceListSection` 이 담당한다.
 *
 * **실화면과 같은 층으로 그린다** (`DESIGN.md §0`) — L0 바닥 위에 L1 카드 하나다.
 * 예전에는 `max-w-screen-md` 흰 페이지에 스켈레톤을 늘어놓아, 로딩이 끝나는 순간
 * 바닥색과 카드 경계가 동시에 생기며 화면이 한 번 뒤집혔다.
 *
 * **제목 자리도 카드 안이다.** 목록의 제목이 카드 제목으로 들어갔기 때문이다 —
 * 밖에 두면 로딩 중에만 제목이 카드 위에 뜬다.
 */
export default function PlacesLoading() {
  return (
    <Canvas>
      <SurfaceStack>
        <Surface>
          <div className="px-4 pt-5 pb-3 md:px-5">
            <Skeleton variant="text" className="h-9 w-40" />
            <Skeleton variant="text" className="mt-2 h-5 w-56" />
          </div>

          <SurfaceList>
            {Array.from({ length: 6 }, (_, index) => (
              <PlaceRowSkeleton key={index} />
            ))}
          </SurfaceList>
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
