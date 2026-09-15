import { Canvas, SurfaceStack } from '@/components/surface'
import { AboutView } from '@/features/about/about-view'
import { messages } from '@/lib/messages'

export const metadata = {
  title: `${messages.about.title} · 혼디가개`,
  description: messages.about.description,
}

/**
 * 서비스 소개 — `/about`.
 *
 * **보호 경로가 아니다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다 — 이 화면의 존재
 * 이유가 **비로그인 모바일 방문자에게 데이터 출처를 보여 주는 것**이라, 로그인 뒤에 두면
 * 표기하지 않은 것과 같다 (`about-view.tsx` 머리 주석).
 *
 * **프리페치도 세션 조회도 없다.** 백엔드를 부르지 않는 정적 화면이라 `HydrationBoundary`
 * 를 두지 않는다 — 없는 주소 하나에 왕복을 만들지 않는 `app/not-found.tsx` 와 같은 판단이다.
 */
export default function AboutPage() {
  return (
    /* L0 바닥은 `main` 이 전폭으로 칠하고 폭은 `SurfaceStack` 이 갖는다 (#453 · #462) */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-screen-md">
        <AboutView />
      </SurfaceStack>
    </Canvas>
  )
}
