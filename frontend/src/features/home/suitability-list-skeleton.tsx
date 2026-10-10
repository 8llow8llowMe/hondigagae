import { Skeleton } from '@/components/skeleton'
import { PlaceInsightCardList } from '@/features/home/place-insight-card'

/**
 * 홈 "갈 만한 곳" 카드의 대기 골격 — 적합도 조회가 하나도 끝나지 않았을 때.
 *
 * **두 곳이 쓴다** (#907). `HomeView` 가 적합도를 기다리는 동안, 그리고 홈 `loading.tsx`
 * 가 서버 응답을 기다리는 동안이다. 폴백이 풀린 직후에도 적합도는 아직 클라이언트에서
 * 대기 중이라 곧바로 이 골격이 다시 선다 — 한 벌이어야 그 순간 카드 수·폭이 갈리지 않는다.
 *
 * **실제 카드와 같은 틀에 담는다** (#1069) — `PlaceInsightCardList` 를 그대로 쓴다. 틀을 따로
 * 그리면 1024 미만의 캐러셀 폭(82%)과 이상의 3열이 골격과 실화면에서 따로 논다.
 *
 * **두 장이다.** 캐러셀에서는 첫 장과 비쳐 보이는 둘째 장이 "옆으로 넘긴다" 를 미리 말하고,
 * 그리드에서는 셋째 칸이 비어 끝 카드 자리가 된다 — mock 과 대부분의 날이 그 모양이다.
 * 골격은 사진 16:10 · 제목 · 메타 · 판정 줄, 카드의 네 층을 그대로 잡는다.
 */
export function SuitabilityListSkeleton() {
  return (
    <PlaceInsightCardList>
      {Array.from({ length: 2 }, (_, index) => (
        <li key={index} className="w-(--home-place-card-w) shrink-0 lg:w-auto">
          <Skeleton variant="thumbnail" className="aspect-16/10" />
          <Skeleton className="mt-3 h-6 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-2 h-7 w-32" />
        </li>
      ))}
    </PlaceInsightCardList>
  )
}
