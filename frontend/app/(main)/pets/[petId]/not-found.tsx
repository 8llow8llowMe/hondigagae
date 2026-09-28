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
 * **카드 이름표는 `h1` 과 함께 바꾸지 않는다 (#980).** 이름표는 "이 화면의 어느 카드인가"
 * 를 말하고 `h1` 은 "이 문서가 무엇인가" 를 말한다 — 다른 질문이다. 이름표까지
 * `notFoundTitle` 로 바꾸면 ① 같은 404 를 `PetEditView` 가 잡았을 때와 카드가 갈리고
 * (#475 · #480 의 축, `route-state-surface.test.ts` 가 쌍으로 잠근다) ② 같은 문장이
 * `h1` · 영역 이름 · `h2` 로 세 번 들린다.
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
 * **`h1` 이 상태 자체를 말한다 (#980)** — 장소·일정 상세의 `not-found.tsx` 와 같다.
 * 예전에는 화면의 이름(`editTitle`)이었다. #481 의 "경계가 화면 이름을 바꾸면 안 된다" 를
 * 따른 것인데, 그 규칙은 **화면이 살아 있다가 예외로 죽은** `error.tsx` 의 것이다 — 지금
 * 어느 화면에서 실패했는지를 알려야 해서다(`error.tsx` 는 그대로 `editTitle` 이다). 없는
 * 반려견에는 수정할 화면이 없고, 탭은 #676 부터 이미 `notFoundTitle` 을 말한다
 * (`petEditPageTitle`). 스크린리더가 문서 제목과 최상위 제목을 연달아 읽을 때 둘이 다른
 * 화면을 가리키지 않게 한다 — `app/resource-state-title.test.ts` 가 짝을 잠근다.
 * `sr-only` 인 것은 보이는 제목을 `EmptyState` 의 `h2` 가 이미 그리기 때문이다.
 *
 * **`export const metadata` 를 여기 두지 않는다 — 이슈 #676.** `page.tsx` 가 비동기
 * 조회 뒤 조건부로 `notFound()` 를 던지는 세그먼트라, Next 16 은 이 파일의 `metadata` 로
 * 되돌리지 않고 `page.tsx` 가 이미 확정해 둔(정상 화면용) 메타데이터를 그대로 쓴다
 * (실측, `docs/architecture-guide.md` §7) — 예전엔 그래서 탭이 항상 "반려견 정보 수정"
 * 이었다. 탭 제목은 `page.tsx` 의 `generateMetadata` 가
 * `petEditPageTitle`(`src/lib/pet/detail-title.ts`)로 정한다.
 */
export default function PetNotFound() {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        <h1 className="sr-only">{messages.pet.notFoundTitle}</h1>

        <Surface aria-label={messages.pet.editTitle}>
          <EmptyState
            title={messages.pet.notFoundTitle}
            character="sitLookup"
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
