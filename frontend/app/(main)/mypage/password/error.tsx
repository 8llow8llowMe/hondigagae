'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외 — 이슈 #481.
 *
 * **왜 따로 두는가.** 예전에는 `mypage/error.tsx` 하나가 세그먼트 셋(`/mypage` ·
 * `/mypage/password` · `/mypage/withdraw`)을 전부 덮었다. 그 파일은 루트 기준이라
 * 폭이 `max-w-screen-md`(768)이고 `h1` 이 `member.myPageTitle` 이다 — 이 화면은
 * `max-w-2xl`(672)에 `h1` 이 `member.passwordTitle` 이라, **비밀번호 변경 중 예외가
 * 났는데 글줄이 한 번 넓어지고 문서의 이름이 "내 정보" 로 바뀌었다.**
 *
 * **경계를 `(root)` 로 내리는 안은 더 나쁘다** — 그러면 이 화면과 탈퇴가 오류 경계를
 * 아예 잃고 상위로 버블한다. 화면마다 하나씩 두는 것이 답이다.
 *
 * **3층 표면이고 카드다** (`DESIGN.md §0`, #475). 폭은 정상 화면(`password/page.tsx`)의
 * `max-w-2xl` 을 그대로 쓴다.
 *
 * **카드에 제목을 주지 않는다 — 정상 화면이 그렇게 한다.** `PasswordView` 의 오류 갈래가
 * 이름 없는 `<Surface>` 안에서 `ErrorState inset="card"` 를 그린다. 성공 갈래의 카드
 * 제목은 `setup ? passwordSetup : passwordChange` 로 **응답을 봐야 정해지는데**, 경계는
 * 그 응답을 갖고 있지 않다 — 정상 화면이 오류 갈래에서 제목을 뺀 이유가 그것이고,
 * 경계도 같은 자리에 선다. **이름표를 새로 짓지 않는다** (`styling-guide.md` §3-1).
 *
 * 그래서 상태 제목은 `h2` 다 — 카드가 `h2` 를 그리지 않으므로 위가 `h1` 하나뿐이다
 * (#456①). 인셋은 카드 안이라 `card`(16/20)다.
 *
 * **`h1` 은 화면의 이름이고 `sr-only` 다** — 정상 화면(`password/page.tsx`)과 같은 키·
 * 같은 방식이다.
 */
export default function PasswordError({ retry }: { error: Error; retry: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        <h1 className="sr-only">{messages.member.passwordTitle}</h1>

        <Surface>
          <ErrorState
            title={messages.member.loadFailedTitle}
            description={messages.member.loadFailedDescription}
            inset="card"
            onRetry={retry}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
