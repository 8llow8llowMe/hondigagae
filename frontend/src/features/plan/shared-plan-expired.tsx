import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 공유 링크가 만료됐다 — 백엔드 `PLAN_024` **410** (#628).
 *
 * **404 갈래(`not-found.tsx`)와 갈라 둔다.** 백엔드가 일부러 나눈 축이다: 없음·폐기·
 * 삭제는 전부 404 로 **같게** 답해 토큰의 존재 여부를 흘리지 않고, 만료만 410 이다.
 * 받은 사람이 **할 수 있는 일이 있는 유일한 갈래**라서 그렇다 — "링크를 만든 사람에게
 * 새 링크를 요청" 은 404 에서는 할 수 없는 말이다(폐기된 링크를 다시 달라고 하는 것은
 * 다른 요청이고, 애초에 폐기인지 만료인지 알려 주지 않는다).
 *
 * **`notFound()` 를 쓰지 않는다.** 그것은 404 하나만 낼 수 있고 문구도 `not-found.tsx`
 * 의 것으로 바뀐다. 그래서 라우트 경계가 아니라 **화면 안에서** 그린다 — 장소 상세가
 * 400(`PlaceDetailInvalidId`)을 다루는 방식과 같다.
 *
 * **HTTP 상태는 200 이다.** 서버 컴포넌트에 상태 코드를 정할 수단이 없다. 이 페이지는
 * `noindex` 라 크롤러가 soft-200 을 잘못 읽을 여지가 없어 받아들였다 (명세 D8-2).
 *
 * **재시도 버튼이 없다.** 만료는 시간이 지나 확정된 상태이고 다시 눌러도 같다 —
 * `EmptyState` 에는 `onRetry` 슬롯 자체가 없다.
 *
 * 다음 행동이 홈인 이유는 `not-found.tsx` 주석이 정본이다 — 미로그인일 수 있어
 * `/plans` 로 보내면 로그인 화면으로 튕긴다.
 */
export function SharedPlanExpired() {
  return (
    <SurfaceStack className="content-container">
      <h1 className="sr-only">{messages.plan.sharedExpiredTitle}</h1>

      <EmptyState
        title={messages.plan.sharedExpiredTitle}
        description={messages.plan.sharedExpiredDescription}
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
