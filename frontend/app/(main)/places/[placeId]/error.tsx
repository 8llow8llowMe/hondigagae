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
 * 담지 않으면 경계도 담지 않는다. `PlaceDetailSection`(`place-detail-section.tsx`)은
 * 404 · 400 · 5xx 세 갈래를 **카드 없이 L0 위에 바로** 그리므로, 여기도 카드를 두지 않는다.
 * 상태 컴포넌트는 L0 바닥 위에 직접 서고 인셋만 `card`(16/20)로 둔다.
 *
 * **정상 화면의 갈래도 같은 축이다** (#480). 예전에는 그쪽이 `inset` 기본값 `main`(40)에
 * 폭 캡도 없어 1920 에서 글줄이 화면 왼쪽 끝에 붙었다 — 같은 실패인데 누가 잡았는지에 따라
 * 자리가 달랐다. 경계 쪽으로 맞췄고, 정상 화면의 `DetailStateShell` 이 같은
 * `content-container` + `card` 를 쓴다. 1920 실측으로 둘 다 컨테이너 1440 · 글줄 284 다.
 *
 * **`rail-layout` 을 붙이지 않는다.** 정상 화면은 좌 400 판정 레일 + 우 본문 2단이지만
 * 여기에는 레일이 없고, grid 를 그대로 쓰면 상태 하나가 400px 첫 열에 갇힌다. 대신
 * `rail-layout` 의 나머지 절반 — 1440 캡 + 가운데 정렬 — 만 갖는 `content-container` 를
 * 쓴다 (`globals.css` 에서 두 클래스가 같은 선언을 공유한다).
 *
 * **`h1` 이 상태 자체를 말한다.** 이 화면의 이름은 응답에서 오는 장소명인데(`h1` 은
 * `place.title` 이다), 그 응답이 없어서 이 문서가 떴다. **탭 제목과는 갈린다** —
 * `placeDetailFallbackTitle` 은 5xx 에서 판정을 피해 목록 제목으로 떨어지는데, 그쪽은
 * 클라이언트 재조회가 성공한 뒤에도 남기 때문이다. 이 `h1` 은 문서와 함께 사라진다.
 *
 * `sr-only` 인 것은 보이는 제목을 `ErrorState` 의 `h2` 가 이미 그리기 때문이다. 같은 말이
 * 두 번 들리는 거래는 #453 · #473 이 이미 받아들였다 — `h1` 이 없으면 문서의 최상위
 * 제목이 `h2` 가 된다.
 */
export default function PlaceDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.place.detailErrorTitle}</h1>

        <ErrorState
          title={messages.place.detailErrorTitle}
          description={messages.common.temporaryErrorDescription}
          inset="card"
          onRetry={reset}
        />
      </SurfaceStack>
    </Canvas>
  )
}
