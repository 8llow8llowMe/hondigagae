'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외.
 * 데이터 부재(404)는 여기로 오지 않는다 — page.tsx 가 notFound() 로 보낸다
 * (architecture-guide.md §7).
 *
 * **3층 표면이고 카드가 아니다** (`DESIGN.md §0`, #475). **카드 판정은 그 세그먼트의 정상
 * 화면을 따른다** — 정상 화면이 상태(로딩·오류·빈)를 카드에 담으면 라우트 경계도 담고,
 * 담지 않으면 경계도 담지 않는다. `PlanDetailView`(`plan-detail-view.tsx`)는 400 과 5xx
 * 두 갈래를 **카드 없이 L0 위에 바로** 그리고 `Surface` 를 아예 import 하지도 않으므로,
 * 여기도 카드를 두지 않는다. 상태 컴포넌트는 L0 바닥 위에 직접 서고 인셋만 `card`(16/20)다.
 *
 * **다만 정상 화면과 축이 아직 갈린다** — 그쪽 상태는 `inset` 기본값 `main`(40)이고 폭 캡도
 * 없는데, 이 경계는 `card` 인셋에 `content-container`(1440 캡)라 md 이상에서 44 다.
 * 어느 쪽으로 맞출지는 **#480** 이 정한다 — 여기서 한쪽만 바꾸면 어긋남이 반대 방향으로
 * 뒤집힐 뿐이라 손대지 않는다.
 *
 * **`rail-layout` 을 붙이지 않는다.** 정상 화면은 좌 개요 레일 + 우 일자 카드 2단이지만
 * 여기에는 레일이 없고, grid 를 그대로 쓰면 상태 하나가 400px 첫 열에 갇힌다. 대신
 * `rail-layout` 의 나머지 절반 — 1440 캡 + 가운데 정렬 — 만 갖는 `content-container` 를
 * 쓴다 (`globals.css` 에서 두 클래스가 같은 선언을 공유한다).
 *
 * **`h1` 이 상태 자체를 말한다.** 이 화면의 이름은 응답에서 오는 일정 제목인데(`h1` 은
 * `PlanOverviewPanel` 이 그린다), 그 응답이 없어서 이 문서가 떴다. `sr-only` 인 것은
 * 보이는 제목을 `ErrorState` 의 `h2` 가 이미 그리기 때문이고, `h1` 이 아예 없으면 문서의
 * 최상위 제목이 그 `h2` 가 된다 (#451 · #473 과 같은 이유).
 */
export default function PlanDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.plan.detailErrorTitle}</h1>

        <ErrorState
          title={messages.plan.detailErrorTitle}
          description={messages.common.temporaryErrorDescription}
          inset="card"
          onRetry={reset}
        />
      </SurfaceStack>
    </Canvas>
  )
}
