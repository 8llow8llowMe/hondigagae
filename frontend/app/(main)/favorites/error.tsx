'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외.
 *
 * **3층 표면이고 카드다** (`DESIGN.md §0`, #475).
 *
 * **카드 판정은 그 세그먼트의 정상 화면을 따른다** — 정상 화면이 상태(로딩·오류·빈)를
 * 카드에 담으면 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다. `loading.tsx` 가
 * "실화면과 같은 층으로 그린다" 를 고른 것과 같은 원리다. 여기서는
 * `FavoriteListSection`(`favorite-list-section.tsx`)이
 * `<Surface lead titleId="favorite-list-heading" title={messages.favorite.listTitle}>`
 * 안에서 상태를 그리므로, 경계도 **같은 카드·같은 이름표**를 쓴다.
 *
 * **판정 3문의 ③("담는 항목이 둘 이상인가")을 "지금 담긴 자식 수" 로 읽지 않는다.**
 * 그렇게 읽으면 정상 화면의 카드들도 전부 카드가 아니어야 한다 — ③ 은 그 면이 **화면의
 * 답을 담는 역할인가**를 묻는다.
 *
 * **부제를 옮기지 않는다.** 정상 화면의 `description`(`저장 순 · n/100곳`)은 목록을 실제로
 * 받았을 때만 나오는 값이고(`countable`), 조회가 실패한 이 문서에는 셀 것이 없다.
 *
 * 상태 컴포넌트는 카드 안이므로 인셋이 `card`(16/20) 그대로다.
 *
 * 폭은 정상 화면·로딩과 같은 `content-container`(1440 캡)다. 예전에는 좌우 인셋 없이
 * `w-full py-6` 이라 이 화면만 글줄이 화면 끝까지 붙었다.
 *
 * **`h1` 은 화면의 이름이고 `sr-only` 다** — `loading.tsx` 와 같은 키·같은 방식이다.
 * 없으면 문서의 최상위 제목이 상태 컴포넌트의 `h2` 가 된다.
 */
export default function FavoritesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.favorite.listTitle}</h1>

        <Surface lead titleId="favorite-list-heading" title={messages.favorite.listTitle}>
          <ErrorState
            title={messages.favorite.loadFailedTitle}
            description={messages.favorite.loadFailedDescription}
            inset="card"
            headingLevel={3}
            onRetry={reset}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
