'use client'

import { ButtonLink } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/*
  **루트 레이아웃이 그려지지 않으므로 전역 스타일을 여기서 다시 싣는다.** 이 파일은
  `app/layout.tsx` 를 **대체**해 `html`/`body` 를 직접 그린다 — 레이아웃이 임포트한
  Pretendard 와 `globals.css` 가 함께 사라져, 다시 싣지 않으면 토큰 클래스가 전부 무효가
  되고 시스템 폰트의 맨 문서가 뜬다. 두 줄은 `app/layout.tsx` 와 같은 순서·같은 경로다.
*/
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'

/**
 * 최후 폴백 — 루트 레이아웃 자체가 죽었을 때 (#907, `architecture-guide.md` §7).
 *
 * **`app/error.tsx` 와 다른 층이다.** 그쪽은 루트 레이아웃 **안**에서 그룹 레이아웃의
 * 예외를 잡는다. 여기로 오는 것은 `app/layout.tsx` 의 예외 — `QueryProvider` ·
 * `ScrollbarReveal` · 메타데이터 조립 — 뿐이고, 그때는 `html`/`body` 까지 없으므로
 * 이 파일이 문서 전체를 그린다. 그래서 `lang="ko"` 와 `body` 의 폰트 클래스도
 * `app/layout.tsx` 와 같은 값이다.
 *
 * **개발 모드에서도 뜬다** (Next 15.2 부터). 오류 오버레이가 그 위에 함께 뜰 뿐이다.
 *
 * **탭 제목을 `<title>` 로 직접 준다.** `metadata` 는 루트 레이아웃이 조립하는데 여기는
 * 그 레이아웃이 없으므로, 두지 않으면 탭에 주소가 뜬다 (Next 문서가 React `<title>` 을 권한다).
 *
 * **셸을 그리지 않고 골격은 `app/error.tsx` 와 같다.** 회색 바닥 위 카드 하나에 다시
 * 시도와 홈으로. 브랜드 락업은 두지 않는다 — 락업 컴포넌트가 의존하는 것이 많지는
 * 않지만, 루트가 죽은 자리에서 가장 짧은 트리가 가장 안전하다. `token-usage.test.ts`
 * 의 `bg-bg-sunken` 허용 목록에 `app/error.tsx` 와 함께 올렸다.
 *
 * **`QueryProvider` 가 없다.** 이 트리 안에서 React Query 훅을 쓰는 컴포넌트를
 * 그리면 provider 가 없어 또 죽는다 — `ErrorState` · `ButtonLink` 는 훅이 없다.
 *
 * **재시도는 `reset` 이 아니라 `retry` 다.** `reset` 은 경계의 오류 상태만 지우고 이미 받은
 * RSC 응답으로 다시 그려, 서버 컴포넌트에서 난 예외는 그대로 또 터진다. `retry` 는
 * `router.refresh()` 로 다시 받아 온 뒤 그린다 (`next/dist/client/components/error-boundary.js`,
 * Next 16.3 에서 stable). 이 경계가 잡는 것은 대부분 서버 쪽(`readSession` 등)이다.
 * 세그먼트 경계 열둘도 #918 에서 같이 `retry` 로 옮겼다.
 */
export default function GlobalError({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="ko">
      <title>{`${messages.common.temporaryErrorTitle} · 혼디가개`}</title>
      <body className="font-sans antialiased">
        <div className="bg-bg-sunken flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10">
          <main id="main-content" className="bg-bg border-border w-full max-w-sm rounded-lg border">
            <h1 className="sr-only">{messages.common.temporaryErrorTitle}</h1>

            <ErrorState
              title={messages.common.temporaryErrorTitle}
              description={messages.common.temporaryErrorDescription}
              inset="card"
              onRetry={retry}
              action={
                <ButtonLink href="/" variant="secondary">
                  {messages.common.notFoundHomeAction}
                </ButtonLink>
              }
            />
          </main>
        </div>
      </body>
    </html>
  )
}
