import Link from 'next/link'

import { Canvas, SurfaceStack } from '@/components/surface'
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
 *
 * **3층 표면이다** (`DESIGN.md §0`, 이슈 #453). **폼 화면의 첫 전환이라** 남은 폼 화면
 * (9번 반려견 폼 · 10번 마이페이지 · 11번 AI 일정 생성)이 이 모양을 따른다.
 */
export default function PlanCreatePage() {
  /*
    **`today` 를 서버에서 만들어 내려보낸다.** 달력이 오늘을 표시하는데, 클라이언트가
    따로 `new Date()` 를 부르면 자정 근처에서 서버 렌더와 하이드레이션이 하루 갈린다
    (일정 상세 · `/ai-plans/new` 와 같은 결정).
  */
  const today = new Date().toISOString().slice(0, 10)

  return (
    /*
      **바닥과 쌓기를 갈랐다** (§0 · `styling-guide.md` §3-1). 이 `main` 이 바로 그 규칙이
      지목하던 패턴이었다 — `mx-auto max-w-2xl ... px-4 py-6` 한 요소가 바닥과 배치를
      겸하고 있어서, `bg-bg-sunken` 을 그대로 얹었다면 672px 컨테이너 안쪽만 회색이 되고
      그 바깥은 흰색으로 남는다. 그래서 `Canvas` 가 전폭으로 바닥을 깔고, 폭 제한
      (`max-w-2xl`)은 그 위에 쌓는 `SurfaceStack` 이 가져간다.

      세로·좌우 여백을 따로 주지 않는다 — `SurfaceStack` 이 모바일은 전폭(카드가 내려앉는다),
      데스크톱은 `md:p-6` 을 이미 준다.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        {/*
          **보이는 제목은 카드가 그린다** (§0 "섹션 제목은 섹션 안에 있다"). 장소 목록
          (#439)과 같은 판단이다 — 이 화면의 카드는 하나뿐이고 그 카드의 이름이 곧 페이지의
          이름이라, 밖에 두면 제목만 바닥 위에 떠 어느 묶음의 제목인지 모호해진다.

          그래서 `h1` 은 `sr-only` 로 남긴다. 보조기기에서 "일정 만들기" 가 h1·h2 로 두 번
          들리는데, 그것을 감수하는 이유도 #439 와 같다 — `Surface` 에 제목 레벨 prop 을
          더하면 없앨 수 있지만 한 규칙에 두 경로가 생긴다. **추측으로 만든 API 를 아무
          화면도 검증하지 않는 것**이 #422 에서 프리미티브 넷을 걷은 이유다.
        */}
        <h1 className="sr-only">{messages.plan.createTitle}</h1>

        {/*
          **폼이 카드 하나다** — 카드 판정 3문(§0)을 셋 다 통과한다.
          ① 자기 제목이 있다(`일정 만들기`) ② 혼자 떼어놔도 말이 된다(이 화면이 하는 일
          전부다) ③ 담는 항목이 여럿이다(반려견 · 날짜 · 제목 · 예산).

          카드를 그리는 것은 페이지가 아니라 뷰다 — 근거는 `plan-create-view.tsx` 주석에.
        */}
        <PlanCreateView today={today} />

        {/*
          **취소는 카드 밖이다.** 액션은 카드가 아니다 (§0 판정에서 "액션 바" 가 빠진다 —
          장소 상세 #443 · 일정 상세 #447 과 같은 결정). L0 바닥 위에 그대로 선다.

          모바일에서 스택 좌우 여백이 0 이지만 링크는 글자 하나라 인셋 없이도 가운데 선다.
        */}
        <Link
          href="/plans"
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 텍스트 크기는 그대로 두고
          // 히트 영역만 키운다
          className="text-body-2 text-fg-muted inline-flex h-11 items-center justify-center self-center underline"
        >
          {messages.plan.createCancel}
        </Link>
      </SurfaceStack>
    </Canvas>
  )
}
