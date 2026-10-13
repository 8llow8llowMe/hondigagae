import type { Metadata } from 'next'

import { Canvas, SurfaceStack } from '@/components/surface'
import { AiPlanCreateView } from '@/features/ai-plan/ai-plan-create-view'
import { todayDay } from '@/lib/date/day'
import { messages } from '@/lib/messages'

export const metadata: Metadata = {
  title: `${messages.aiPlan.createTitle} · 혼디가개`,
  description: messages.aiPlan.createDescription,
}

/**
 * AI 일정 조건 입력 — `/ai-plans/new`.
 *
 * **서버 프리페치를 하지 않는다.** 이 화면의 초기 데이터는 반려견 목록뿐이고 폼 상태가
 * 화면의 본체다 (architecture-guide.md §9 결정 트리). 보호 경로는 루트 `proxy.ts` 의
 * `PROTECTED_PATHS` 가 `'/ai-plans'` 로 이미 덮는다.
 *
 * 한 컬럼이다. 아트보드 04 는 좌측에 조건을 남긴 2단이지만 그것은 **결과를 보면서 조건을
 * 고치는 화면**이라 미리보기가 함께 있을 때만 성립한다 — 여기서는 조건만 있다.
 *
 * **3층 표면이다** (`DESIGN.md §0`, 이슈 #473). 폼 화면 규약(#453 일정 만들기 · #464
 * 반려견 등록)을 그대로 따른다 — `Canvas` 가 전폭 바닥을 깔고 `SurfaceStack` 이 폭과
 * 간격을 맡으며, 보이는 제목은 뷰가 그리는 카드 하나가 갖는다.
 */
export default async function AiPlanNewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; pet?: string | string[] }>
}) {
  /*
    `?from={jobId}` — 실패 화면의 `조건 바꾸기` 가 조건을 되살리기 위해 붙인다.
    **조건 자체를 URL 에 담지 않는다** (명세 S8 미결 2) — `jobId` 만 넘기고 값은
    `sessionStorage` 에서 읽는다.
  */
  const { from, pet } = await searchParams

  /*
    **`today` 를 서버에서 만들어 내려보낸다.** 달력이 "오늘" 을 표시하는데, 클라이언트가
    따로 `new Date()` 를 부르면 자정 근처에서 서버 렌더와 하이드레이션이 하루 갈린다
    (일정 상세와 같은 결정).

    **`toISOString()` 으로 자르지 않는다** (#1396). 그것은 UTC 날짜라 KST 오전 9시 전에는 어제였고,
    달력의 `min` 으로 들어가 어제가 열렸다. 다른 화면과 같은 `todayDay`(서버 로컬 날짜 — 운영
    컨테이너는 `TZ: ${TIME_ZONE}`)를 쓴다.
  */
  const today = todayDay(new Date())

  return (
    /*
      **바닥과 쌓기를 갈랐다** (§0 · `styling-guide.md` §3-1). 예전 `div` 하나가
      `mx-auto max-w-screen-md … px-4 py-6` 로 바닥·폭·여백을 겸하고 있어서, 거기에
      `bg-bg-sunken` 을 그대로 얹었다면 컨테이너 안쪽만 회색이 되고 바깥이 흰색으로 남는다.
      `Canvas` 가 전폭으로 바닥을 깔고 폭 제한은 `SurfaceStack` 이 가져간다.

      **폭이 768 → 672 로 줄었고 글줄도 함께 좁아진다.** 데스크톱 실측으로 688 → 582
      (−106px, 15%)다: 전은 `max-w-screen-md`(768) − `md:px-10` 40×2 = 688, 후는
      `max-w-2xl`(672) − `SurfaceStack md:p-6` 24×2 − 카드 테두리 1×2 −
      `INSET_CLASS.card md:px-5` 20×2 = 582. **그래도 672 를 쓰는 것은 폼 화면 한 단 폭이
      #453(일정 만들기) · #464(반려견 등록)와 같아야 하기 때문이다** — 폼만 홀로 넓으면
      같은 종류의 화면 사이에서 글줄 끝이 흔들린다. #464 의 "카드가 인셋을 더 먹는다" 는
      512 → 672 로 **넓힐 때** 의 근거라 여기에 붙이지 않는다 (좁히는 방향에 붙이면 두 번
      좁아지는 것을 "그대로" 라고 말하게 된다). 세로·좌우 여백은 `SurfaceStack` 이 준다 —
      모바일은 전폭(카드가 내려앉는다), 데스크톱은 `md:p-6`.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        {/*
          **보이는 제목은 카드가 그린다** (§0 "섹션 제목은 섹션 안에 있다"). 이 화면의
          카드는 하나뿐이고 그 카드의 이름이 곧 페이지의 이름이라, 밖에 두면 제목만 바닥
          위에 떠 어느 묶음의 제목인지 모호해진다 (#453 · #464 와 같은 판단).

          그래서 `h1` 은 `sr-only` 로 남긴다. 보조기기에서 "AI 일정 만들기" 가 h1·h2 로
          두 번 들리는 것은 감수한다 — `Surface` 에 제목 레벨 prop 을 더하면 없앨 수
          있지만 한 규칙에 두 경로가 생긴다.
        */}
        <h1 className="sr-only">{messages.aiPlan.createTitle}</h1>

        {/*
          `?pet=<id>` — 들어온 링크가 지목한 아이를 미리 고른다 (#1431). 반려견 목록에 없는 id 면
          무시되고 지금 규칙(헤더 선택 → 대표견)으로 떨어진다(`defaultAiPlanPetIds`). 키가 두 번
          붙은 배열은 어느 쪽을 믿을지 모르므로 없는 것으로 읽는다.
        */}
        <AiPlanCreateView
          fromJobId={singleParam(from)}
          requestedPetId={singleParam(pet)}
          today={today}
        />
      </SurfaceStack>
    </Canvas>
  )
}

/** 검색 파라미터 하나 — 빈 값 · 여러 번 붙은 키는 없는 것으로 읽는다 */
function singleParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}
