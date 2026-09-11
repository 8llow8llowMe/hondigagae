'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외.
 *
 * **숫자가 아닌 `petId` 가 여기로 온다.** 컨트롤러가 `@PathVariable long` 이라
 * `/pets/abc` 는 404 가 아니라 400(`PET_113`) 이고, `notFound()` 가 걸리지 않는다
 * (수정-세부명세 D5). 데이터 부재(404)는 `not-found.tsx` 가 받는다.
 *
 * **3층 표면이고 카드다** (`DESIGN.md §0`, #475).
 *
 * **카드 판정은 그 세그먼트의 정상 화면을 따른다** — 정상 화면이 상태(로딩·오류·빈)를
 * 카드에 담으면 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다. 여기서는
 * `PetEditView`(`pet-edit-view.tsx`)가 진입 시점의 조회 실패를
 * `<Surface aria-label={messages.pet.editTitle}>` 안에서 그린다 — 그래서 경계도 **같은
 * 카드·같은 이름표**를 쓴다. 이름표가 `title` 이 아니라 `aria-label` 인 것도 정상 화면을
 * 따른 것이다: 이 화면의 카드는 보이는 제목 줄을 갖지 않는다.
 *
 * **판정 3문의 ③("담는 항목이 둘 이상인가")을 "지금 담긴 자식 수" 로 읽지 않는다.**
 * 그렇게 읽으면 정상 화면의 카드들도 전부 카드가 아니어야 한다 — ③ 은 그 면이 **화면의
 * 답을 담는 역할인가**를 묻는다.
 *
 * 상태 컴포넌트는 카드 안이므로 인셋이 `card`(16/20) 그대로다.
 *
 * **폭이 `max-w-lg`(512) → `max-w-2xl`(672) 로 넓어진다.** 예전 값은 폼이 512 이던 시절의
 * 것이고, #464 가 반려견 폼을 672 로 넓히면서 `page.tsx` 만 따라갔다 — 예외에서 글줄이
 * 한 번 좁아지고 있었다.
 *
 * **`h1` 은 화면의 이름(`editTitle`)이고 `sr-only` 다.** 상태 컴포넌트는 `h2` 만 내므로
 * 두지 않으면 문서의 최상위 제목이 `h2` 가 된다 (#451 · #473 과 같은 이유).
 */
export default function PetEditError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        <h1 className="sr-only">{messages.pet.editTitle}</h1>

        <Surface aria-label={messages.pet.editTitle}>
          <ErrorState
            title={messages.pet.loadFailedTitle}
            description={messages.pet.loadFailedDescription}
            inset="card"
            onRetry={reset}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
