'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * `(main)` 그룹의 공통 오류 경계 — 자기 `error.tsx` 가 없는 세그먼트가 여기로 온다 (#907).
 *
 * **왜 `app/error.tsx` 가 아니라 여기인가.** 라우트 경계는 그것을 둔 세그먼트의
 * **레이아웃 안**에서 그려진다. `app/error.tsx` 는 루트 레이아웃 안, 즉 `(main)/layout.tsx`
 * **밖**이라 헤더·탭바·푸터(`AppShell`)가 통째로 사라진 채 오류 문구만 남고, 그 셸을
 * 다시 그리려면 `authed` 가 필요한데 클라이언트 경계는 세션을 읽을 수 없다. 이 파일은
 * 그룹 레이아웃 안에 서므로 **셸이 그대로 남고** 사용자는 헤더로 어디든 갈 수 있다 —
 * 그래서 "홈으로" 버튼을 따로 두지 않는다 (`app/error.tsx` 는 셸이 없어 둔다).
 *
 * **잡는 것은 페이지·뷰의 렌더 예외뿐이다.** `(main)/layout.tsx` 자체의 예외는 이 경계
 * 밖이라 `app/error.tsx` 로 간다 (Next 규약 — 경계는 같은 세그먼트의 레이아웃을 감싸지
 * 않는다). 데이터 부재(404)는 여기로 오지 않는다 — 각 화면이 `notFound()` 나
 * `EmptyState` 로 처리한다 (`architecture-guide.md` §7).
 *
 * **카드를 두지 않는다** (`DESIGN.md §0`). 이 경계에는 "정상 화면" 이 하나가 아니라
 * 열 남짓이라(홈 · 소개 · 병원·약국 · 올레 · 일정 목록/만들기 · 약관 · 개인정보 …) 따라갈
 * 카드 판정이 없다. 일정 상세 아래(브리핑 · 장소 담기 · 하루 다시 만들기 · 일정 주변 병원)는
 * `plans/[planId]/error.tsx` 가 먼저 잡는다 — 상세 경계 넷(`places/[placeId]` ·
 * `plans/[planId]`)과 같이 L0 바닥 위에 상태 컴포넌트가 바로 서고 인셋만 `card` 다.
 * 폭도 같은 `content-container`(1440 캡)다.
 *
 * **`h1` 이 상태 자체를 말한다.** 어느 화면에서 실패했는지 이 경계는 모르므로 화면 이름을
 * 지어내지 않는다 — 전역 404(`app/not-found.tsx`)와 같은 판단이다. 보이는 제목은
 * `ErrorState` 의 `h2` 가 그리므로 `sr-only` 다.
 *
 * 문구는 5xx 톤(`temporaryError*`)이다 — 세그먼트 경계 열둘과 같다.
 *
 * **재시도는 `reset` 이 아니라 `retry` 다.** `reset` 은 경계의 오류 상태만 지우고 이미 받은
 * RSC 응답으로 다시 그려, 서버 컴포넌트에서 난 예외는 그대로 또 터진다. `retry` 는
 * `router.refresh()` 로 다시 받아 온 뒤 그린다 (`next/dist/client/components/error-boundary.js`,
 * Next 16.3 에서 stable). 이 경계가 잡는 것은 대부분 서버 쪽(`readSession` 등)이다.
 * 세그먼트 경계 열둘도 #918 에서 같이 `retry` 로 옮겼다.
 */
export default function MainError({ retry }: { error: Error; retry: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.common.temporaryErrorTitle}</h1>

        <ErrorState
          title={messages.common.temporaryErrorTitle}
          description={messages.common.temporaryErrorDescription}
          inset="card"
          onRetry={retry}
        />
      </SurfaceStack>
    </Canvas>
  )
}
