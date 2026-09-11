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
 * **이 경계는 `(root)` 밖이라 `/mypage/password` · `/mypage/withdraw` 까지 덮는다.**
 * `loading.tsx` 는 스켈레톤 모양이 폼 화면과 달라 `(root)` 로 내렸지만, 경계를 내리면
 * 두 폼 화면이 이 세그먼트의 오류 경계를 잃는다 — 그래서 자리를 그대로 둔다. 대신 폭 ·
 * 제목 · `h1` 은 **루트(`/mypage`)를 따른다**: 두 폼 화면은 `max-w-2xl`(672)이고 `h1` 도
 * `member.passwordTitle` · `member.withdrawTitle` 이라, 그 화면에서 예외가 뜨면 글줄이
 * 768 폭으로 한 번 넓어지고 문서의 이름도 `내 정보` 로 바뀐다. 경계를 화면마다 쪼개는
 * 것이 답이고 **[#481] 로 떼 뒀다** — 이 이슈의 범위 밖이다.
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
            onRetry={reset}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
