import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { Canvas, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 경로가 가리키는 일정이 없다 (백엔드 404).
 *
 * **"없는 일정" 과 "남의 일정" 을 구분하지 않는다** — 백엔드가 본인 소유가 아니면
 * 404 로 응답한다(컨트롤러 설명 명시). 화면도 존재 여부를 흘리지 않는다.
 *
 * **중립 톤이다.** 데이터 부재에 danger 톤이나 재시도 버튼을 쓰지 않는다 —
 * `EmptyState` 에는 `onRetry` 슬롯 자체가 없다 (`component-guide.md` §10).
 *
 * **3층 표면이고 카드가 아니다** (`DESIGN.md §0`, #475). **카드 판정은 그 세그먼트의 정상
 * 화면을 따른다** — 정상 화면이 상태를 카드에 담으면 라우트 경계도 담고, 담지 않으면
 * 경계도 담지 않는다. `PlanDetailView`(`plan-detail-view.tsx`)는 상태를 **카드 없이 L0
 * 위에 바로** 그리고 카드(`Surface`)를 쓰지 않으므로 여기도 카드를 두지 않는다 — 축을 맞추며 들인 `SurfaceStack` 은 카드가 아니라 카드 열이다.
 * 상태 컴포넌트는 L0 바닥 위에 직접 서고 인셋만 `card`(16/20)로 둔다.
 * 폭은 `error.tsx` 와 같은 `content-container`(1440 캡)다 — 레일이 없으므로 `rail-layout`
 * 의 grid 절반은 쓰지 않는다.
 *
 * **정상 화면의 갈래도 같은 축이다** (#480). 예전에는 그쪽이 `inset` 기본값 `main`(40)에
 * 폭 캡도 없어 1920 에서 글줄이 화면 왼쪽 끝에 붙었다 — 같은 실패인데 누가 잡았는지에 따라
 * 자리가 달랐다. 경계 쪽으로 맞췄고, 정상 화면의 `DetailStateShell` 이 같은
 * `content-container` + `card` 를 쓴다. 1920 실측으로 둘 다 컨테이너 1440 · 글줄 284 다.
 *
 * **`h1` 이 상태 자체를 말한다.** 이 화면의 이름은 응답에서 오는 일정 제목인데 그 일정이
 * 없다. `sr-only` 인 것은 보이는 제목을 `EmptyState` 의 `h2` 가 이미 그리기 때문이다.
 */
export default function PlanDetailNotFound() {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.plan.detailNotFoundTitle}</h1>

        <EmptyState
          title={messages.plan.detailNotFoundTitle}
          description={messages.plan.detailNotFoundDescription}
          inset="card"
          action={
            <ButtonLink href="/plans" variant="secondary">
              {messages.plan.backToList}
            </ButtonLink>
          }
        />
      </SurfaceStack>
    </Canvas>
  )
}
