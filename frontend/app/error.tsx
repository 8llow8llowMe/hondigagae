'use client'

import Link from 'next/link'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'
import { ButtonLink } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/**
 * 루트 오류 경계 — 그룹 레이아웃이 죽었을 때, 그리고 `(auth)` 화면 (#907).
 *
 * **여기로 오는 것은 셋이다.** `(main)` 의 페이지 예외는 그 아래 경계가 먼저 잡는다 —
 * 세그먼트 열둘은 자기 `error.tsx`, 나머지는 `(main)/error.tsx`. 남는 것은
 * ① `(main)/layout.tsx`(세션 읽기) · `(auth)/layout.tsx` 의 예외, ② 전역 `not-found.tsx`
 * 자체의 예외, ③ **`(auth)` 그룹 페이지의 예외**(그 그룹에는 `error.tsx` 가 없다)다.
 * 이것이 없으면 Next 기본 화면(영문 "Application error")이 뜬다.
 *
 * **`AppShell` 을 그리지 않는다.** 셸은 `authed` 로 헤더·탭바 메뉴를 가르는데 클라이언트
 * 경계는 세션을 읽을 수 없다. 모르는 채 `false` 로 그리면 로그인한 사용자에게 로그아웃된
 * 헤더가 뜬다 — 전역 404 가 "404 라고 로그아웃한 것처럼 보이면 사용자가 자기 세션이
 * 끊긴 줄 안다" 로 거부한 그 모양이다. **그래서 `(auth)` 셸과 같은 골격**이다: 브랜드
 * 락업(홈 링크) + 회색 바닥 위 카드 하나. ③ 의 인증 화면은 원래 nav 를 두지 않는 그룹이라
 * (전역nav-세부명세 D0) 셸 없는 이 모양이 오히려 제자리다. `AppShell` 밖 화면이 자기 표식을 갖는 방식은
 * `(auth)/layout.tsx` 가 정했고(#532), 그 판단을 그대로 가져온다.
 *
 * **`Canvas` 를 쓰지 않고 직접 칠한다.** `Canvas` 의 `page-canvas` 는
 * `100dvh - var(--header-h)` 라 `GlobalHeader` 가 있다는 전제다 — 여기는 헤더가 없어
 * 그대로 쓰면 바닥이 56px 못 미쳐 끊긴다. `token-usage.test.ts` 가 `bg-bg-sunken` 의
 * 소유자를 검사하므로 그 허용 목록에 이 파일을 근거와 함께 올렸다 — `(auth)/layout.tsx`
 * 와 같은 "`Canvas` 를 쓸 수 없는 화면" 예외다.
 *
 * **출구가 둘이다.** 다시 시도(`retry`)와 홈으로. 셸이 없어 헤더로 갈 수 없으므로
 * `(main)/error.tsx` 와 달리 홈 버튼을 둔다 — 락업 링크도 홈이지만 "다음에 무엇을 할 수
 * 있나" 는 버튼이 말해야 한다. 문구는 전역 404 와 같은 `notFoundHomeAction`(`홈으로`)이다.
 *
 * 락업 크기는 `(auth)` 셸과 같은 2배(심볼 48 · 워드마크 40)다 — 헤더가 없는 화면에서
 * 로고가 유일한 신원 단서라는 근거가 여기도 그대로다.
 *
 * **재시도는 `reset` 이 아니라 `retry` 다.** `reset` 은 경계의 오류 상태만 지우고 이미 받은
 * RSC 응답으로 다시 그려, 서버 컴포넌트에서 난 예외는 그대로 또 터진다. `retry` 는
 * `router.refresh()` 로 다시 받아 온 뒤 그린다 (`next/dist/client/components/error-boundary.js`,
 * Next 16.3 에서 stable). 이 경계가 잡는 것은 대부분 서버 쪽(`readSession` 등)이다.
 * 세그먼트 경계 열둘도 #918 에서 같이 `retry` 로 옮겼다.
 */
export default function RootError({ retry }: { error: Error; retry: () => void }) {
  return (
    <div className="bg-bg-sunken flex min-h-dvh w-full flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="flex justify-center">
        <Link
          href="/"
          className="text-fg focus-visible:ring-brand-500 inline-flex min-h-11 items-center gap-4 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <BrandSymbol size={48} />
          <Wordmark height={40} />
        </Link>
      </header>

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
  )
}
