'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외.
 * 데이터 부재(404)는 여기로 오지 않는다 — PlaceListSection 이 EmptyState 로 처리한다
 * (architecture-guide.md §7).
 *
 * **3층 표면이고 카드다** (`DESIGN.md §0`, #475).
 *
 * **카드 판정은 그 세그먼트의 정상 화면을 따른다** — 정상 화면이 상태(로딩·오류·빈)를
 * 카드에 담으면 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다. 여기서는
 * `page.tsx` 가 `<Surface aria-label={messages.place.pageTitle}>` 하나에 목록을 담고
 * `loading.tsx` 도 같은 카드를 흉내 내므로, 경계도 **같은 카드·같은 이름표**를 쓴다.
 *
 * **카드가 제목을 잃었다** (#531). 페이지 제목이 카드 **위** 제목 줄로 올라가면서
 * `page.tsx` 의 `lead`·`title` 이 걷혔고, 경계도 따라왔다 — 한쪽만 옮기면 오류가 뜨는
 * 순간 제목이 카드 안팎으로 뛴다. 이름은 `aria-label` 이 잇는다.
 *
 * **제목 줄에 보기 토글을 두지 않는다.** 정상 화면의 토글은 `listHref`/`mapHref` 가
 * 필요하고 그것은 `searchParams` 에서 온다 — 오류 경계는 그것을 받지 않는다 (부제를
 * 옮기지 않는 것과 같은 이유다). 목록이 실패한 자리에서 지도로 보내는 것도 아니다.
 *
 * **판정 3문의 ③("담는 항목이 둘 이상인가")을 "지금 담긴 자식 수" 로 읽지 않는다.**
 * 그렇게 읽으면 정상 화면의 카드들도 전부 카드가 아니어야 한다 — ③ 은 그 면이 **화면의
 * 답을 담는 역할인가**를 묻는다.
 *
 * **부제는 옮기지 않는다.** 정상 화면의 `description` 은 `filterSummaryLine(filters)` 라
 * `searchParams` 가 있어야 만들어지는데, 오류 경계는 그것을 받지 않는다.
 *
 * 상태 컴포넌트는 카드 안이므로 인셋이 `card`(16/20) 그대로다.
 *
 * **`rail-layout` 을 붙이지 않는다.** 정상 화면은 좌 280 필터 레일 + 우 목록 2단이지만
 * 여기에는 레일이 없고, grid 를 그대로 쓰면 카드가 280px 첫 열에 갇힌다. 대신
 * `rail-layout` 의 나머지 절반 — 1440 캡 + 가운데 정렬 — 만 갖는 `content-container` 를
 * 쓴다 (`globals.css` 에서 두 클래스가 같은 선언을 공유한다).
 *
 * **`h1` 은 화면의 이름이고 `sr-only` 다** — 목록·지도 두 갈래와 같은 키·같은 방식이다.
 */
export default function PlacesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.place.pageTitle}</h1>

        {/* 정상 화면의 제목 줄과 같은 자리·같은 인셋이다 — 제목 글자는 위 `h1` 의 사본이라
            `aria-hidden` 이고, 그래서 이름이 두 번 들리지 않는다 */}
        <div className={cn('pt-3 md:pt-0', INSET_CLASS.card)}>
          <p aria-hidden className="text-title-1 text-fg font-semibold break-keep">
            {messages.place.pageTitle}
          </p>
        </div>

        <Surface aria-label={messages.place.pageTitle}>
          <ErrorState
            title={messages.place.errorTitle}
            description={messages.common.temporaryErrorDescription}
            inset="card"
            /* 카드가 `h2` 를 그리지 않으므로 상태 제목이 한 단 올라간다 (#456① · #531) */
            headingLevel={2}
            onRetry={reset}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
