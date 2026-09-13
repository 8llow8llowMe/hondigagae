import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { Canvas, SurfaceStack } from '@/components/surface'
import { AppShell } from '@/features/nav/app-shell'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'

/**
 * 전역 404 — **주소가 어느 라우트와도 안 맞을 때다** (#494).
 *
 * 이것이 없으면 Next 기본 화면(`404 / This page could not be found.`)이 그대로 뜬다.
 * 영문이고, 헤더도 푸터도 돌아갈 링크도 없어 **사용자가 할 수 있는 일이 뒤로가기뿐**이다.
 * 한국어 서비스에서 이 화면만 영어이기도 했다.
 *
 * **세그먼트 404 와 다른 층이다.** 없는 장소·일정·반려견은 각 세그먼트의 `not-found.tsx`
 * 가 도메인 문구와 그 목록으로 가는 링크까지 갖고 이미 잘 그린다 — **라우트 자체가 없을
 * 때만** 비어 있었다. 그래서 여기 문구는 무엇이 없는지 짐작하지 않고 "그런 주소가 없다"
 * 만 말한다 (`messages.common.notFound*`).
 *
 * **셸을 직접 조립한다.** 주소가 어느 라우트와도 안 맞으면 Next 는 **루트 레이아웃 안에서**
 * 이 파일만 그린다 — `(main)` 그룹 레이아웃이 닿지 않아 헤더·푸터가 자동으로 따라오지
 * 않는다. 그래서 `AppShell` 을 여기서 쓴다. 복사가 아니라 뽑아낸 것이라 세로 뼈대
 * (`min-h-dvh` + `flex-1`)가 한 벌이다 — 404 는 저장소에서 가장 짧은 화면이라 그 짝이
 * 깨지면 푸터 아래 흰 띠가 가장 먼저 여기서 난다 (#456③).
 *
 * **세션을 읽는 이유는 헤더·탭바뿐이다.** 로그인 상태에 따라 메뉴가 갈리는데, 404 라고
 * 로그아웃한 것처럼 보이면 사용자가 자기 세션이 끊긴 줄 안다. 반려견 프리페치는 하지
 * 않는다 — **없는 주소 하나에 백엔드 왕복을 만들지 않는다.**
 *
 * **보호 라우트와 섞이지 않는다.** `/plans/...` 처럼 `proxy.ts` 의 `PROTECTED_PATHS` 아래
 * 있는 주소는 미로그인이면 여기 닿기 전에 `/login?returnTo=` 로 간다 — 라우트가 있는지
 * 없는지를 미로그인 사용자에게 흘리지 않는 쪽이 맞다. 로그인 상태에서만 이 화면이 뜬다.
 *
 * **카드를 두지 않는다** (`DESIGN.md §0`). 형제 `not-found.tsx` 셋과 같은 판정이다 —
 * 상태 컴포넌트가 L0 바닥 위에 바로 서고 인셋만 `card`(16/20)로 둔다. 폭은 같은
 * `content-container`(1440 캡)다.
 *
 * **`h1` 이 상태 자체를 말한다.** 이 화면에는 이름이 될 자료가 없다. `sr-only` 인 것은
 * 보이는 제목을 `EmptyState` 의 `h2` 가 이미 그리기 때문이다 — 형제 셋과 같은 모양이다.
 */
export default async function GlobalNotFound() {
  const session = await readSession()

  return (
    <AppShell authed={session !== null}>
      <Canvas as="main" id="main-content">
        <SurfaceStack className="content-container">
          <h1 className="sr-only">{messages.common.notFoundTitle}</h1>

          <EmptyState
            title={messages.common.notFoundTitle}
            description={messages.common.notFoundDescription}
            inset="card"
            action={
              /*
                **돌아갈 곳을 둘 준다.** 홈이 먼저다 — 어디서 헤맸든 처음으로 가는 길이
                기본이고, `장소 찾기` 는 이 서비스에서 실제로 하려던 일에 가장 가깝다.
                재시도 버튼은 두지 않는다: 없는 주소는 다시 눌러도 없다
                (`api-integration-guide.md` §3 · `EmptyState` 에 `onRetry` 슬롯이 없다).
              */
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/">{messages.common.notFoundHomeAction}</ButtonLink>
                <ButtonLink href="/places" variant="secondary">
                  {messages.common.notFoundPlacesAction}
                </ButtonLink>
              </div>
            }
          />
        </SurfaceStack>
      </Canvas>
    </AppShell>
  )
}
