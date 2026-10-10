import { Canvas } from '@/components/surface'
import { SharedPlanNotFound } from '@/features/plan/shared-plan-not-found'

/**
 * 공유 링크가 유효하지 않다 — 백엔드 `PLAN_023` 404 (#628).
 *
 * **본문은 `features/plan/shared-plan-not-found.tsx` 가 갖는다.** 만료(410)와 **같은
 * 말을 하지 않는지**를 테스트가 나란히 비교해야 하는데, 라우트 파일은 그 비교를 위해
 * 임포트하기 어렵다. 410 쪽(`SharedPlanExpired`)이 애초에 화면 안에서 그려지는
 * 컴포넌트라 두 갈래를 같은 층에 두는 편이 맞기도 하다.
 */
export default function SharedPlanNotFoundRoute() {
  return (
    <Canvas as="main" id="main-content">
      <SharedPlanNotFound />
    </Canvas>
  )
}
