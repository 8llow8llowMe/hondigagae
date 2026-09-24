import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { EmergencySkeleton } from '@/features/emergency/emergency-skeleton'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 병원·약국 최초 진입 로딩 (#907). 좌표가 잡힌 뒤의 조회 로딩은 `EmergencySection` 이
 * 같은 `EmergencySkeleton` 으로 담당한다.
 *
 * **이 세그먼트에는 자식이 없어 그룹으로 좁힐 것이 없다.** `plans/[planId]/emergency` 는
 * 다른 세그먼트다.
 *
 * **목록 갈래의 모양으로 그린다.** 이 화면은 `?view=map` 으로 지도 갈래가 갈리지만
 * `loading.tsx` 는 `searchParams` 를 받지 못한다 (Next 규약). 기본값이 목록
 * (`EMERGENCY_DEFAULT_VIEW`)이고 탭바·배너에서 오는 진입이 전부 기본값이라 목록 골격을
 * 고른다 — 지도 갈래는 SDK 가 뜰 때까지 자기 골격(`EmergencyMapSkeleton`)을 따로 갖는다.
 *
 * **`page.tsx` 는 서버에서 기다리는 것이 없다.** 좌표가 브라우저에만 있어 프리페치가
 * 없고, 이 폴백이 서는 시간은 라우트 전환의 RSC 왕복뿐이다. 그래도 두는 이유는
 * 사용성 검토(#905 §6)가 잡은 "이동 중 아무 반응이 없다" 그 자체다 — 짧아도 반응이다.
 *
 * **grid 는 `Canvas` 가 아니라 안쪽 `div` 에 건다.** 실화면(`EmergencyListView`)이 그렇다 —
 * 좌표·필터 상태가 클라이언트에만 있어 2단 grid 가 뷰 컴포넌트 안으로 들어갔고, `page.tsx`
 * 의 `Canvas` 는 민짜다. 같은 자리에 같은 클래스를 걸어야 폴백이 풀릴 때 카드가 제자리다.
 *
 * 레일 열은 자리만 세운다 (`PlaceFilterRail` 과 같은 이유 — 반경·조건은 브라우저 상태다).
 * 머리의 검색 줄과 모바일 칩 두 줄도 자리만 잡되 **높이는 실화면 값**이다 (390 실측).
 *
 * **위치 안내 블록(`PositionFallbackHead`)은 잡지 않는다.** 위치 권한이 없거나 실패했을 때만
 * 서는 블록이라 대부분의 진입에서 없다 — 그 갈래에서는 폴백이 풀릴 때 머리가 그만큼
 * 늘어나는 것을 받아들인다. 칩 아래 안내 줄(`24시간 진료가 확인된 곳은 …`)도 결과에 따라
 * 서는 줄이라 잡지 않는다. 개수 부제는 잘린 목록일 때만 빠지므로 자리를 잡는다.
 */
export default function EmergencyLoading() {
  return (
    <Canvas as="main" id="main-content">
      <div className="rail-layout rail-layout-filter">
        <h1 className="sr-only">{messages.emergency.pageTitle}</h1>

        {/* 레일의 자리만 잡는다 — 내용은 위 주석 참고 */}
        <div aria-hidden className="rail-column hidden lg:block" />

        <SurfaceStack className="list-column">
          <Surface
            fill
            titleId="emergency-list-heading"
            title={messages.emergency.pageTitle}
            /* 개수 부제 — 응답이 오면 선다 (잘린 목록일 때만 빠진다) */
            description={<Skeleton className="h-4.5 w-40" />}
            /* 보기 토글 자리 — 링크가 아직 없으므로 크기만 잡는다 */
            trailing={<Skeleton className="h-11 w-22 shrink-0" />}
            tools={
              <div aria-hidden>
                {/* 검색 — 입력 + 검색 버튼, 둘 다 44 */}
                <div className={cn('flex gap-2 pt-3', INSET_CLASS.card)}>
                  <Skeleton className="h-11 flex-1 rounded-md" />
                  <Skeleton className="h-11 w-16 shrink-0 rounded-md" />
                </div>
                {/* 모바일 칩 두 줄 — 조건 칩(sm 36) · 유형 세그먼트 + 반경 칩(36) */}
                <div className={cn('flex flex-col gap-2 py-3 lg:hidden', INSET_CLASS.card)}>
                  <div className="flex gap-1.5">
                    <Skeleton className="h-9 w-24 rounded-md" />
                    <Skeleton className="h-9 w-20 rounded-md" />
                  </div>
                  <div className="flex gap-1.5">
                    <Skeleton className="h-9 flex-1 rounded-md" />
                    <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
                  </div>
                </div>
              </div>
            }
            aria-busy
          >
            <EmergencySkeleton />
          </Surface>
        </SurfaceStack>
      </div>
    </Canvas>
  )
}
