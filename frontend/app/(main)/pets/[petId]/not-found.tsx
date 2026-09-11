import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 경로가 가리키는 반려견이 없다. **타인 소유도 같은 404 다** — 백엔드가 존재
 * 자체를 노출하지 않는다 (공통명세 S4).
 *
 * **중립 톤이다.** 데이터 부재에 danger 톤이나 재시도 버튼을 쓰지 않는다 —
 * `EmptyState` 에는 `onRetry` 슬롯 자체가 없다 (`component-guide.md` §10).
 *
 * **3층 표면이고 카드다** (`DESIGN.md §0`, #475).
 *
 * **카드 판정은 그 세그먼트의 정상 화면을 따른다** — 정상 화면이 상태(로딩·오류·빈)를
 * 카드에 담으면 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다. 여기서는
 * `PetEditView`(`pet-edit-view.tsx`)가 조회 실패를
 * `<Surface aria-label={messages.pet.editTitle}>` 안에서 그린다 — 그 갈래에는 404 문구도
 * 들어 있다(`kind === 'not-found'`). `error.tsx` 와 **같은 카드·같은 이름표**를 쓴다.
 *
 * **판정 3문의 ③("담는 항목이 둘 이상인가")을 "지금 담긴 자식 수" 로 읽지 않는다.**
 * 그렇게 읽으면 정상 화면의 카드들도 전부 카드가 아니어야 한다 — ③ 은 그 면이 **화면의
 * 답을 담는 역할인가**를 묻는다.
 *
 * 상태 컴포넌트는 카드 안이므로 인셋이 `card`(16/20) 그대로다.
 *
 * 폭은 `error.tsx` 와 함께 `max-w-2xl`(672)로 맞춘다 — #464 가 폼을 512 → 672 로 넓힌
 * 뒤에도 이 두 파일만 512 에 남아 있었다.
 *
 * **`h1` 은 화면의 이름(`editTitle`)이고 `sr-only` 다.** `EmptyState` 는 `h2` 만 내므로
 * 두지 않으면 문서의 최상위 제목이 `h2` 가 된다.
 */
export default function PetNotFound() {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        <h1 className="sr-only">{messages.pet.editTitle}</h1>

        <Surface aria-label={messages.pet.editTitle}>
          <EmptyState
            title={messages.pet.notFoundTitle}
            description={messages.pet.notFoundDescription}
            inset="card"
            /* `<Link>` 안에 `<Button>` 을 넣지 않는다 — 탭 정지가 둘이 되고 Space 가 안쪽
               버튼을 누른다. 버튼 외형의 이동은 `ButtonLink` 다 (styling-guide §2, #464) */
            action={
              <ButtonLink href="/pets" variant="secondary">
                {messages.pet.backToList}
              </ButtonLink>
            }
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
