'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외 — 이슈 #481.
 *
 * **왜 따로 두는가.** 예전에는 `mypage/error.tsx` 하나가 세그먼트 셋을 전부 덮었고,
 * 그 파일은 루트 기준이라 폭이 768 이고 `h1` 이 `member.myPageTitle` 이다 — 탈퇴 화면은
 * `max-w-2xl`(672)에 `h1` 이 `member.withdrawTitle` 이라, **탈퇴를 확인하던 중 예외가
 * 났는데 문서의 이름이 "내 정보" 로 바뀌었다.** 되돌릴 수 없는 조작을 앞둔 화면이라
 * 지금 어디에 있는지가 특히 중요하다.
 *
 * **3층 표면이고 카드다** (`DESIGN.md §0`, #475). 폭은 정상 화면(`withdraw/page.tsx`)의
 * `max-w-2xl` 을 그대로 쓴다.
 *
 * **카드 이름표는 정상 화면과 같다.** `WithdrawView` 가
 * `<Surface lead titleId="withdraw-heading" title={messages.member.withdrawTitle}>` 을
 * 그리므로 경계도 같은 `messages` 키와 `lead` 를 쓴다 — **이름표를 새로 짓지 않는다**
 * (`styling-guide.md` §3-1). 그래서 상태 제목은 `h3` 다 (#456①).
 *
 * `/mypage` 와 달리 이 화면의 정상 갈래에는 조회가 없다 — 확인 화면이라 프리페치할 것이
 * 없다(`withdraw/page.tsx`). 그래도 렌더 예외는 날 수 있고, 그때 카드 안에 남아야
 * 사용자가 어디에 있었는지 잃지 않는다.
 *
 * **`h1` 은 화면의 이름이고 `sr-only` 다** — 정상 화면과 같은 키·같은 방식이다.
 */
export default function WithdrawError({ retry }: { error: Error; retry: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        <h1 className="sr-only">{messages.member.withdrawTitle}</h1>

        <Surface lead titleId="withdraw-heading" title={messages.member.withdrawTitle}>
          <ErrorState
            title={messages.member.loadFailedTitle}
            description={messages.member.loadFailedDescription}
            inset="card"
            headingLevel={3}
            onRetry={retry}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
