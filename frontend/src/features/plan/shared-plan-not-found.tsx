import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 공유 링크가 유효하지 않다 — 백엔드 `PLAN_023` 404 (#628).
 *
 * **네 가지가 전부 여기로 온다**: 없는 토큰 · 폐기된 링크 · 삭제된 일정 · 확정에서
 * 초안으로 되돌린 일정. 백엔드가 넷을 **같게** 답하는 것은 어느 쪽인지 알려 주면
 * 토큰을 찍어 보는 쪽에 "이 토큰은 있었다" 를 흘리기 때문이다. 화면도 원인을 단정하지
 * 않는다.
 *
 * **만료는 여기가 아니다** — 그쪽은 410 이고 받은 사람이 할 수 있는 일("새 링크를
 * 요청한다")이 있어 문구가 다르다 (`SharedPlanExpired`).
 *
 * **재시도 버튼이 없다.** 데이터 부재는 재시도해도 같다 — `EmptyState` 에는 `onRetry`
 * 슬롯 자체가 없다 (`component-guide.md` §10).
 *
 * **다음 행동은 `/plans` 가 아니라 홈이다.** 이 화면에 온 사람은 로그인하지 않았을 수
 * 있고, `/plans` 는 보호 경로라 로그인 화면으로 튕긴다 — 링크가 깨진 사람에게 갑자기
 * 로그인을 요구하는 꼴이 된다.
 */
export function SharedPlanNotFound() {
  return (
    <SurfaceStack className="content-container">
      <h1 className="sr-only">{messages.plan.sharedNotFoundTitle}</h1>

      <EmptyState
        title={messages.plan.sharedNotFoundTitle}
        character="sitLookup"
        description={messages.plan.sharedNotFoundDescription}
        inset="card"
        action={
          <ButtonLink href="/" variant="secondary">
            {messages.common.notFoundHomeAction}
          </ButtonLink>
        }
      />
    </SurfaceStack>
  )
}
