import { Canvas } from '@/components/surface'
import { AboutView } from '@/features/about/about-view'
import { MarkAboutSeen } from '@/features/about/mark-about-seen'
import { messages } from '@/lib/messages'

export const metadata = {
  title: `${messages.about.title} · 혼디가개`,
  description: messages.about.description,
}

/**
 * 서비스 소개 — `/about` (#611 → #635).
 *
 * **보호 경로가 아니다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다 — 심사자가 로그인 없이
 * 모바일로 둘러본다.
 *
 * **프리페치도 세션 조회도 없다.** 백엔드를 부르지 않는 정적 화면이라 `HydrationBoundary` 를
 * 두지 않는다.
 *
 * **`SurfaceStack` 을 쓰지 않는다.** 그린/연녹 밴드가 전폭이어야 해서(§0 "바닥은 전폭")
 * `Canvas` 바로 아래에 `IntroBand` 가 쌓인다. 안쪽 폭 1152 는 밴드가 갖는다.
 *
 * **여기를 열면 홈의 소개 카드가 더는 서지 않는다** (#950) — `MarkAboutSeen` 이 쿠키를 쓴다.
 * 그리는 것이 없는 클라이언트 조각이라 이 페이지는 정적 그대로다.
 */
export default function AboutPage() {
  return (
    <Canvas as="main" id="main-content">
      <MarkAboutSeen />
      <AboutView />
    </Canvas>
  )
}
