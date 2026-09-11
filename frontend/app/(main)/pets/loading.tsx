import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceList, SurfaceStack } from '@/components/surface'
import {
  PET_SKELETON_COUNT,
  PetListBaselineSkeleton,
  PetRowSkeleton,
} from '@/features/pet/pet-row-skeleton'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 최초 진입 로딩. 섹션 내부 재조회 로딩은 `PetListSection` 이 담당한다.
 *
 * **실화면과 같은 층으로 그린다** (`DESIGN.md §0`) — L0 바닥 위에 L1 카드 하나다.
 * 예전에는 흰 페이지에 `rounded-lg` 카드 두 장을 늘어놓아, 로딩이 끝나는 순간 바닥색과
 * 카드 경계가 동시에 생기며 화면이 한 번 뒤집혔다 (#439 · #462 와 같은 수정).
 *
 * **`main` 이자 `h1` 이다** — `(main)/layout.tsx` 는 `div#main` 만 주므로 `main`
 * 랜드마크를 내는 것은 페이지뿐이다. 폴백이 떠 있는 동안 랜드마크가 0개가 되면 안 된다.
 *
 * 머리 스켈레톤은 실제 제목 크기를 따른다 — 모바일 `title-2`(26) / md `display`(36).
 */
export default function PetsLoading() {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-screen-md">
        <h1 className="sr-only">{messages.pet.listTitle}</h1>

        <Surface>
          <div className={cn('pt-5 pb-3', INSET_CLASS.card)}>
            <Skeleton variant="text" className="h-6 w-32 md:h-9" />
            <Skeleton variant="text" className="mt-1 h-5 w-64" />
          </div>

          {/* 기준 줄 자리까지 세운다 — 없으면 로드되는 순간 이 줄이 끼어들며 행이 내려앉는다 */}
          <PetListBaselineSkeleton />

          <SurfaceList aria-busy>
            {Array.from({ length: PET_SKELETON_COUNT }, (_, index) => (
              <PetRowSkeleton key={index} />
            ))}
          </SurfaceList>
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
