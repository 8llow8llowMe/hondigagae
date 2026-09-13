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
 * 카드에 담으면 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다. 여기서는
 * `MyPageSections`(`my-page-sections.tsx`)가
 * `<Surface lead titleId="my-page-heading" title={messages.member.myPageTitle}>` 안에서
 * `ErrorState inset="card"` 를 그리므로, 경계도 **같은 카드·같은 이름표**를 쓴다.
 *
 * **판정 3문의 ③("담는 항목이 둘 이상인가")을 "지금 담긴 자식 수" 로 읽지 않는다.**
 * 그렇게 읽으면 정상 화면의 카드들도 전부 카드가 아니어야 한다 — ③ 은 그 면이 **화면의
 * 답을 담는 역할인가**를 묻는다.
 *
 * 상태 컴포넌트는 카드 안이므로 인셋이 `card`(16/20) 그대로다. 예전 `md:px-10` 은 페이지
 * 인셋 40 이라, 카드 글줄(20)보다 20px 더 들어가 있었다.
 *
 * **이 경계는 이제 `/mypage` 만 덮는다** (#481). 자리는 `(root)` 밖 그대로지만 하위
 * 세그먼트가 각자 경계를 갖게 돼서, Next 가 가장 가까운 것을 고르면 여기까지 오지 않는다:
 * `password/error.tsx` · `withdraw/error.tsx`.
 *
 * **쪼갠 이유.** 예전에는 이 파일 하나가 셋을 덮었는데 폭도 `h1` 도 루트 기준(768 ·
 * `member.myPageTitle`)이라, 두 폼 화면(`max-w-2xl` 672)에서 예외가 뜨면 글줄이 한 번
 * 넓어지고 **문서의 이름이 `내 정보` 로 바뀌었다** — 비밀번호를 바꾸던 중인데 스크린리더는
 * 마이페이지를 읽는다. **경계를 `(root)` 로 내리는 안은 더 나쁘다**: 두 폼 화면이 오류
 * 경계를 아예 잃고 상위로 버블한다. 화면마다 하나씩 두는 것이 답이었다.
 *
 * `loading.tsx` 는 스켈레톤 모양이 폼 화면과 달라 진작 `(root)` 로 내려가 있다 — 그쪽은
 * 경계를 잃는 문제가 없어 자리를 옮기는 것으로 풀렸다.
 *
 * **`h1` 은 화면의 이름이고 `sr-only` 다** — `(root)/loading.tsx` 와 같은 키·같은 방식이다.
 */
export default function MyPageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-screen-md">
        <h1 className="sr-only">{messages.member.myPageTitle}</h1>

        <Surface lead titleId="my-page-heading" title={messages.member.myPageTitle}>
          <ErrorState
            title={messages.member.loadFailedTitle}
            description={messages.member.loadFailedDescription}
            inset="card"
            headingLevel={3}
            onRetry={reset}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
