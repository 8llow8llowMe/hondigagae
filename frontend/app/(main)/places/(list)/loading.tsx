import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceList, SurfaceStack } from '@/components/surface'
import { PlaceRowSkeleton } from '@/features/place/place-row-skeleton'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 최초 진입 로딩. 섹션 내부 재조회 로딩은 `PlaceListSection` 이 담당한다.
 *
 * **실화면과 같은 층으로 그린다** (`DESIGN.md §0`) — L0 바닥 위에 L1 카드 하나다.
 * 예전에는 `max-w-screen-md` 흰 페이지에 스켈레톤을 늘어놓아, 로딩이 끝나는 순간
 * 바닥색과 카드 경계가 동시에 생기며 화면이 한 번 뒤집혔다.
 *
 * **`main` 이자 `h1` 이다** (#475). `(main)/layout.tsx` 는 `div#main` 만 주므로 `main`
 * 랜드마크를 내는 것은 페이지뿐이다 — 폴백이 떠 있는 동안 랜드마크가 0개가 되면 안 된다.
 * 같은 이유로 `h1` 도 선다: 카드 제목이 스켈레톤이라 폴백 중에는 문서에 제목이 하나도
 * 없었다. 형제 셋(`favorites` · `mypage/(root)` · `pets`)은 이미 그렇게 돼 있었고 이
 * 파일만 남아 있었다.
 *
 * **가로 배치도 정상 화면과 같다** (#475). `page.tsx` 는 `Canvas` 에
 * `rail-layout rail-layout-filter` 를 걸어 lg 에서 목록 카드를 x=280(`--rail-filter`)부터
 * 시작하는데, 폴백이 전폭이면 **로딩이 끝나는 순간 카드가 옆으로 뛴다.** 형제 셋은 폭을
 * `SurfaceStack` 에 주지만(`content-container` · `max-w-screen-md`) 이 화면은 2단이라
 * 폭·캡이 `Canvas` 의 grid 에 있다 — 같은 클래스를 같은 자리에 건다.
 *
 * **레일 열은 비워 둔다.** `PlaceFilterRail` 과 모바일 `PlaceFilterChips` 는 둘 다
 * `filters`(URL) 와 `authed`(세션)를 받는데 `loading.tsx` 는 `searchParams` 를 받지 않는다
 * (Next 규약). 칩·필터의 스켈레톤을 지어내면 실제와 다른 모양이 잠깐 서므로, 열의 **자리만**
 * 세우고 내용은 비운다 — 잡으려는 것이 카드의 가로 위치이기 때문이다.
 *
 * **제목 자리도 카드 안이다.** 목록의 제목이 카드 제목으로 들어갔기 때문이다 —
 * 밖에 두면 로딩 중에만 제목이 카드 위에 뜬다.
 *
 * 좌우 인셋은 문자열이 아니라 `INSET_CLASS.card` 참조다 — 규칙이 한 군데 있으면 한
 * 군데만 어긋난다 (`lib/ui/inset.ts`, #386).
 */
export default function PlacesLoading() {
  return (
    <Canvas as="main" id="main-content" className="rail-layout rail-layout-filter">
      {/* 레일의 자리만 잡는다 — 내용은 위 주석 참고 */}
      <div aria-hidden className="hidden lg:block" />

      <SurfaceStack>
        <h1 className="sr-only">{messages.place.pageTitle}</h1>

        <Surface>
          <div className={cn('pt-5 pb-3', INSET_CLASS.card)}>
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
