'use client'

import { useRef, useState, useSyncExternalStore } from 'react'

import { Banner } from '@/components/banner'
import { CloseIcon } from '@/components/icons'
import { Surface } from '@/components/surface'
import { hasSeenAboutIn, markAboutSeen } from '@/lib/about/seen-cookie'
import { messages } from '@/lib/messages'

/**
 * 비로그인 첫 방문자의 서비스 소개 카드 (#950).
 *
 * **자동으로 옮기지도, 팝업을 띄우지도 않는다.** 홈은 설명 없이 오늘 상태부터 보여 준다
 * (소개 명세 2026-09-15 §1-1 · §1-3) — 이 카드는 그 첫 카드 **아래**에 서서, 궁금한
 * 사람만 `/about` 으로 간다.
 *
 * **서는지는 서버가 정한다** — `page.tsx` 가 세션과 `hd_about_seen` 쿠키로 `showAboutIntro`
 * 를 만든다. 브라우저는 두 자리만 거든다:
 *
 * - `dismissed` — × 를 누른 그 화면에서 바로 치운다
 * - `seen` — **뒤로/앞으로 가기**. 그때는 서버를 거치지 않고 캐시된 페이로드(`showAboutIntro:
 *   true`)를 다시 쓰므로, 닫았거나 `/about` 을 연 뒤 돌아오면 카드가 되살아난다. 서버 스냅숏은
 *   `false` 라 하이드레이션은 서버 그림 그대로이고, 캐시에서 다시 그릴 때만 쿠키가 막는다
 *
 * **× 는 링크 밖, 형제다.** `Banner` 는 줄 전체가 `<a>` 라 안에 `<button>` 을 넣으면 대화형
 * 요소가 겹친다(HTML 이 금지). 그래서 `Banner` 를 고치지 않고 옆에 세운다.
 *
 * **캐릭터를 주지 않는다** — 홈에서 개는 올레 배너 한 마리다 (DESIGN.md §0-5).
 *
 * **닫으면 초점을 다음 카드로 넘긴다.** 누른 버튼이 사라지면 초점이 `body` 로 떨어져 키보드 ·
 * 스크린리더 사용자가 홈 맨 위부터 다시 찾아 내려와야 한다(WCAG 2.4.3). **전제: 이 카드의
 * `Surface`(`<section>`) 바로 다음 형제가 AI 배너 `Surface` 다** (`home-view.tsx`) — 순서를
 * 바꾸면 여기의 대상도 같이 본다. 형제가 없으면 초점을 옮기지 않을 뿐 깨지지는 않는다.
 */

/** 쿠키는 바뀌어도 알려 주지 않는다 — 구독할 것이 없다. 다시 그릴 때마다 스냅숏을 읽는다 */
function subscribeNothing(): () => void {
  return () => {}
}
export function AboutIntroCard() {
  const [dismissed, setDismissed] = useState(false)
  const seen = useSyncExternalStore(
    subscribeNothing,
    () => hasSeenAboutIn(document.cookie),
    () => false,
  )
  const rowRef = useRef<HTMLDivElement>(null)

  if (dismissed || seen) return null

  return (
    <Surface>
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
            const next = rowRef.current
              ?.closest('section')
              ?.nextElementSibling?.querySelector<HTMLElement>('a, button')

            markAboutSeen()
            setDismissed(true)
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
