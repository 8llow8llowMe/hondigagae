import { EmergencyView } from '@/features/emergency/emergency-view'
import { messages } from '@/lib/messages'

export const metadata = {
  title: `${messages.emergency.pageTitle} · 혼디가개`,
  description: messages.emergency.pageDescription,
}

/**
 * 주변 병원 · 약국 — 아트보드 `혼디가개 긴급 시설` 01(모바일) · 03(상태).
 *
 * **서버 프리페치가 없다.** 조회에 `lat`/`lng` 가 필수인데 좌표는 브라우저에만 있어
 * 서버가 무엇을 조회할지 모른다. `architecture-guide.md` §9 확정표에 이 화면 행을 넣었다.
 *
 * 지도(아트보드 02 · 04 우측 열)는 이 범위가 아니다 — 이슈 #14(카카오 키 대기).
 * 그래서 데스크톱도 한 컬럼이다. 2단은 우측에 지도가 생길 때 만든다 —
 * 지금 빈 열을 만들어 두면 그 열이 무엇인지 설명할 수 없다.
 */
export default function EmergencyPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-screen-md">
      <header className="px-4 pt-5 pb-1 md:px-10 lg:pt-6">
        <h1 className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold">
          {messages.emergency.pageTitle}
        </h1>
      </header>

      <EmergencyView />
    </main>
  )
}
