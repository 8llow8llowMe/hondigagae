import Link from 'next/link'

import { PlanCreateView } from '@/features/plan/plan-create-view'
import { messages } from '@/lib/messages'

export const metadata = {
  title: `${messages.plan.createTitle} · 혼디가개`,
  description: messages.plan.createDescription,
}

/**
 * 직접 만들기 — 아트보드 `혼디가개 여행 일정` 04 의 만들기 시트 "직접 만들기" 갈래.
 *
 * **서버 프리페치가 없다.** 폼이라 채울 초기값이 없다 (`architecture-guide.md` §9
 * 결정 트리 1번). 반려견 목록은 클라이언트가 조회한다 — 반려견 등록 폼과 같은 판단이다.
 *
 * **AI 갈래는 만들지 않았다.** 그 화면이 아직 없다 (공통명세 S2).
 */
export default function PlanCreatePage() {
  /*
    **`today` 를 서버에서 만들어 내려보낸다.** 달력이 오늘을 표시하는데, 클라이언트가
    따로 `new Date()` 를 부르면 자정 근처에서 서버 렌더와 하이드레이션이 하루 갈린다
    (일정 상세 · `/ai-plans/new` 와 같은 결정).
  */
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main
      id="main-content"
      className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8"
    >
      <header>
        <h1 className="text-display text-fg font-extrabold">{messages.plan.createTitle}</h1>
        <p className="text-body-2 text-fg-muted mt-2">{messages.plan.createDescription}</p>
      </header>

      <PlanCreateView today={today} />

      <Link
        href="/plans"
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 텍스트 크기는 그대로 두고
        // 히트 영역만 키운다
        className="text-body-2 text-fg-muted inline-flex h-11 items-center justify-center self-center underline"
      >
        {messages.plan.createCancel}
      </Link>
    </main>
  )
}
