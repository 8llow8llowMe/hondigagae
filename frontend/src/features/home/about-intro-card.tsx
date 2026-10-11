'use client'

import { useRef, useSyncExternalStore } from 'react'

import { Banner } from '@/components/banner'
import { CloseIcon } from '@/components/icons'
import { Surface } from '@/components/surface'
import { hasSeenAboutIn, markAboutSeen } from '@/lib/about/seen-cookie'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 비로그인 첫 방문자의 서비스 소개 카드 (#950).
 *
 * **자동으로 옮기지도, 팝업을 띄우지도 않는다.** 홈은 설명 없이 오늘 상태부터 보여 준다
 * (소개 명세 2026-09-15 §1-1 · §1-3) — 이 카드는 오늘 상태 **아래**에 서서, 궁금한
 * 사람만 `/about` 으로 간다.
 *
 * **홈은 이 카드를 한 자리에 둔다** (#1356) — 우측 열 머리, `오늘 갈 만한 곳` 바로 앞. 1024 미만은
 * 오늘 요약 카드 바로 다음이다(`home-view.tsx`). #963 은 폭마다 자리가 달라 `display: none` 사본
 * 둘을 두었는데, 홈 DOM 을 모바일 우선으로 다시 짜면서 한 자리로 모였다. **닫기 상태는 부르는
 * 쪽이 갖는다**(`onDismiss`).
 *
 * **서는지는 서버가 정한다** — `page.tsx` 가 세션과 `hd_about_seen` 쿠키로 `showAboutIntro`
 * 를 만든다. 브라우저는 두 자리만 거든다:
 *
 * - × — 누른 그 화면에서 바로 치운다. **이 카드가 아니라 홈의 상태다**(`onDismiss`). 사본 둘이
 *   한 상태를 나눠 쓰려고 올린 것인데(#963), 한 벌이 된 뒤에도 쿠키를 구독하는 안(`markAboutSeen`
 *   이 알림)보다 단순하다 — 쿠키를 못 쓰는 브라우저에서도 닫힌다
 * - `seen` — **뒤로/앞으로 가기**. 그때는 서버를 거치지 않고 캐시된 페이로드(`showAboutIntro:
 *   true`)를 다시 쓰므로, 닫았거나 `/about` 을 연 뒤 돌아오면 카드가 되살아난다. 서버 스냅숏은
 *   `false` 라 하이드레이션은 서버 그림 그대로이고, 캐시에서 다시 그릴 때만 쿠키가 막는다
 *
 * **× 는 링크 밖, 형제다.** `Banner` 는 줄 전체가 `<a>` 라 안에 `<button>` 을 넣으면 대화형
 * 요소가 겹친다(HTML 이 금지). 그래서 `Banner` 를 고치지 않고 옆에 세운다.
 *
 * **캐릭터를 주지 않는다** — 홈은 데이터 화면이라 개가 서지 않는다 (DESIGN.md §0-5, #1356 전에는
 * 올레 배너 한 마리였다).
 *
 * **닫으면 초점을 다음 카드로 넘긴다.** 누른 버튼이 사라지면 초점이 `body` 로 떨어져 키보드 ·
 * 스크린리더 사용자가 홈 맨 위부터 다시 찾아 내려와야 한다(WCAG 2.4.3). **전제: 이 카드의
 * `Surface`(`<section>`) 바로 다음 형제가 다음 카드다** (`home-view.tsx`) — `오늘 갈 만한 곳` 이다
 * (`home-about-link.test.ts` 가 잠근다). 순서를 바꾸면 여기의 대상도 같이 본다. 형제가 없으면 초점을 옮기지 않을 뿐 깨지지는 않는다.
 */

/** 쿠키는 바뀌어도 알려 주지 않는다 — 구독할 것이 없다. 다시 그릴 때마다 스냅숏을 읽는다 */
function subscribeNothing(): () => void {
  return () => {}
}
export function AboutIntroCard({
  className,
  onDismiss,
}: {
  /** 레이아웃 · 표시 유틸리티만 (component-guide §3) */
  className?: string
  /** × — 닫기 상태는 홈이 갖는다 */
  onDismiss: () => void
}) {
  const seen = useSyncExternalStore(
    subscribeNothing,
    () => hasSeenAboutIn(document.cookie),
    () => false,
  )
  const rowRef = useRef<HTMLDivElement>(null)

  if (seen) return null

  return (
    // `exactOptionalPropertyTypes` — `undefined` 를 그대로 넘기지 않고 문자열로 모은다
    <Surface className={cn(className)}>
      <div ref={rowRef} className="flex items-center">
        <Banner
          href="/about"
          title={messages.home.aboutIntroTitle}
          description={messages.home.aboutIntroDescription}
          inset="card"
          className="min-w-0 flex-1"
        />
        {/*
          icon-only 라 `aria-label` 이 이름이다. 누르는 자리 44 · 아이콘 20 — 아이콘 오른끝이
          카드 인셋(16 → 768 이상 20)에 맞도록 `me` 로 (44 − 20) ÷ 2 = 12 를 덜어 낸다.
        */}
        <button
          type="button"
          onClick={() => {
            /*
              **보이는 첫 컨트롤이다** (#1356). 다음 카드 머리에는 폭마다 하나만 보이는 링크 둘
              (모바일 글자 링크 · `md` 이상 버튼)이 있어, DOM 첫 요소를 집으면 768 이상에서
              `display: none` 링크에 `focus()` 를 걸어 초점이 body 로 떨어졌다.
            */
            const candidates =
              rowRef.current
                ?.closest('section')
                ?.nextElementSibling?.querySelectorAll<HTMLElement>('a, button') ?? []
            const next = [...candidates].find((el) => el.getClientRects().length > 0)

            markAboutSeen()
            onDismiss()
            next?.focus()
          }}
          aria-label={messages.home.aboutIntroDismiss}
          className="text-fg-subtle hover:text-fg focus-visible:ring-brand-500 me-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none md:me-2"
        >
          <CloseIcon size={20} />
        </button>
      </div>
    </Surface>
  )
}
