/**
 * AI 일정 생성·작업 상태 화면이 3층 표면 위에 선다 — 이슈 #473 (#455 로드맵 11번).
 *
 * **소스를 문자열로 읽는다.** `AiPlanCreateView` · `AiPlanJobView` 는 `usePetList` ·
 * `useForm` · `useAiPlanJob` · `useRouter` 가 걸려 있어 node 환경에서 렌더되지 않고
 * (`testing-guide.md` §1), 두 페이지는 서버 컴포넌트다. 여기서 지키려는 것은 렌더 결과가
 * 아니라 **표면 계약**이다 — 무엇이 바닥이고 무엇이 카드이며 인셋이 어느 값인가.
 * 일정 만들기(#453)의 `plan-create-surface.test.ts` · 반려견 폼(#464)의
 * `pet-form-surface.test.ts` 와 같은 방식이다.
 *
 * **렌더되는 표시 전용 컴포넌트는 여기서 보지 않는다** — `AiPlanDraftPreview` 의 카드 수 ·
 * 제목 레벨은 실제 마크업에 대해 `ai-plan-draft-preview.test.ts` 가 단언한다. 소스 문자열
 * 단언은 렌더할 수 없을 때의 차선이다.
 *
 * **주석을 걷은 사본에 대해 단언한다.** 이 저장소의 주석은 근거를 길게 적어 클래스명·
 * 컴포넌트명이 주석 안에 그대로 등장한다 — 걷지 않으면 **주석 문자열에 속아 통과한다**
 * (#451 의 전례). 반대로 "없어야 한다" 는 단언은 걷지 않으면 주석 때문에 실패한다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as code } from '@/test/source'

const newPage = code('app/(main)/ai-plans/new/page.tsx')
const jobPage = code('app/(main)/ai-plans/jobs/[jobId]/page.tsx')
const createView = code('src/features/ai-plan/ai-plan-create-view.tsx')
const createForm = code('src/features/ai-plan/ai-plan-create-form.tsx')
const disclosure = code('src/features/ai-plan/ai-plan-details-disclosure.tsx')
const optionsSection = code('src/features/ai-plan/ai-plan-options-section.tsx')
const pickerSheet = code('src/features/ai-plan/ai-plan-place-picker-sheet.tsx')
const jobView = code('src/features/ai-plan/ai-plan-job-view.tsx')
const commitPanel = code('src/features/ai-plan/ai-plan-commit-panel.tsx')
const itemRow = code('src/features/ai-plan/ai-plan-draft-item-row.tsx')
const canceled = code('src/features/ai-plan/ai-plan-canceled.tsx')

describe('/ai-plans/new — 페이지가 바닥과 쌓기를 가른다 (#473)', () => {
  it('Canvas 와 SurfaceStack 을 쓴다 — 2a 프리미티브가 없다', () => {
    expect(newPage).toContain("import { Canvas, SurfaceStack } from '@/components/surface'")
    expect(newPage).toContain('<Canvas as="main" id="main-content">')
    expect(newPage).toContain('<SurfaceStack')
  })

  /*
    바닥은 전폭이어야 한다 (§0). 폭 제한이 `Canvas` 쪽에 붙으면 컨테이너 바깥이 흰색으로
    남는다 — 예전 `div` 하나가 `mx-auto max-w-screen-md … px-4 py-6` 로 바닥·폭·여백을
    겸하고 있었다.
  */
  it('max-w-2xl 이 Canvas 가 아니라 SurfaceStack 에 붙는다', () => {
    expect(newPage).toMatch(/<SurfaceStack className="[^"]*max-w-2xl/)
    expect(newPage).not.toMatch(/<Canvas[^>]*max-w-/)
  })

  /* 세로·좌우 여백은 `SurfaceStack` 이 준다 — 페이지가 다시 주면 두 번 밀린다 */
  it('페이지가 자기 페이지 인셋을 다시 주지 않는다', () => {
    expect(newPage).not.toMatch(/<Canvas[^>]*\bp[xy]?-\d/)
    expect(newPage).not.toMatch(/<SurfaceStack className="[^"]*\bp[xy]?-\d/)
  })

  /* 카드를 뷰가 그린다 — 페이지가 그리기 시작하면 인셋 판정이 두 파일로 갈린다 */
  it('페이지는 카드를 그리지 않는다', () => {
    expect(newPage).not.toMatch(/<Surface[\s/>]/)
  })

  it('보이는 제목은 카드가 그린다 — 페이지 h1 은 sr-only 다', () => {
    expect(newPage).toContain('<h1 className="sr-only">')
    expect(newPage).not.toContain('text-title-1')
    expect(newPage).not.toContain('text-display')
  })

  /* `?from` · `today` 를 서버에서 만드는 규약은 표면 전환으로 바뀌지 않는다 */
  it('서버가 만들던 값(from · today)을 그대로 내려보낸다', () => {
    expect(newPage).toContain('const { from } = await searchParams')
    expect(newPage).toContain('<AiPlanCreateView fromJobId={from ?? null} today={today} />')
  })
})

describe('/ai-plans/new — 네 상태가 한 카드에 든다 (#473)', () => {
  /*
    **`lead` 가 `<Surface>` 의 prop 이라는 것까지 잠근다.** `toContain('lead')` 로 두면
    주석·변수명 어디에 있어도 통과해서, 제목이 `md:text-display` 를 잃어도 아무것도
    실패하지 않는다 — 이 카드 제목은 예전 페이지 `h1` 의 크기를 이어받은 것이다.
  */
  it('뷰가 Surface 를 import 하고 lead 카드를 그린다', () => {
    expect(createView).toContain("import { Surface } from '@/components/surface'")
    expect(createView).toMatch(/<Surface\s+lead\b/)
    expect(createView.match(/<Surface[\s/>]/g)).toHaveLength(1)
  })

  it('카드 제목·부제가 createTitle · createDescription 이다', () => {
    expect(createView).toContain('title={messages.aiPlan.createTitle}')
    expect(createView).toContain('{messages.aiPlan.createDescription}')
  })

  /*
    **상태에 따라 카드가 생겼다 사라지지 않는다** (#440). 네 갈래가 전부 같은 껍데기를
    거쳐야 하므로 `AiPlanCreateSurface` 의 사용처 수로 잠근다 — 하나를 빠뜨리면 그 상태에서
    화면의 흰 면이 통째로 없어진다.
  */
  it('조회 중 · 오류 · 0마리 · 폼 넷이 모두 같은 껍데기를 거친다', () => {
    expect(createView.match(/<AiPlanCreateSurface>/g)).toHaveLength(4)
  })

  it('카드 안 상태 컴포넌트가 inset="card" 를 받는다', () => {
    expect(createView).toMatch(/<ErrorState\s+inset="card"/)
    expect(createView).toMatch(/<EmptyState\s+inset="card"/)
  })

  it('카드 안 인셋이 card(16/20)다 — 페이지 값 40 을 쓰지 않는다', () => {
    expect(createView).toContain('INSET_CLASS.card')
    expect(createView).not.toContain('INSET_CLASS.main')
    expect(createView).not.toContain('md:px-10')
  })

  /*
    **폼 래퍼의 세로 여백은 폼의 `gap` 에서 나온다** (#453 이 정한 리듬).
    위 여백 + 제목 줄의 `pb-3`(12) = 폼 `gap`, 아래 여백 = 폼 `gap`.
    `AiPlanCreateForm` 의 루트는 `gap-6`(24)이므로 `pt-3 pb-6` 이다 — 일정 만들기 폼
    (`gap-5`)의 `pt-2 pb-5` 를 그대로 베끼면 12px 어긋난다.

    **폼 쪽 `gap` 까지 함께 잠근다.** 폼이 `gap` 을 바꾸면 이 계산이 조용히 깨지는데,
    폼의 테스트는 자기 간격만 보므로 아무것도 실패하지 않는다.
  */
  it('폼 래퍼 여백이 폼의 gap-6 과 같은 리듬이다 (pt-3 pb-6)', () => {
    expect(createForm).toContain('className="flex flex-col gap-6"')
    expect(createView).toContain("cn('pt-3 pb-6', INSET_CLASS.card)")
  })
})

describe('접기 블록은 카드 안 L2 다 (#473)', () => {
  /* 카드가 `h2` 를 가지므로 접기 머리글은 그 아래 한 단계다 */
  it('토글 제목이 h3 다 — h2 가 아니다', () => {
    expect(disclosure).toMatch(/<h3 className="flex flex-col">/)
    expect(disclosure).not.toContain('<h2')
  })

  /* 접기 안의 구역은 접기보다 한 단계 아래다 — 같은 레벨이면 포함 관계가 뒤집힌다 */
  it('접기 안 AiPlanOptionsSection 제목이 h4 다', () => {
    expect(optionsSection).toContain('<h4')
    expect(optionsSection).not.toContain('<h3')
  })

  /* 자기 면·테두리를 갖지 않는다 — 카드 안에 카드를 넣으면 층 채널이 깨진다 (§0) */
  it('자기 카드·면·테두리를 그리지 않는다', () => {
    expect(disclosure).not.toMatch(/<Surface[\s/>]/)
    expect(disclosure).not.toContain('rounded-lg')
    expect(disclosure).not.toContain('border-border')
    expect(disclosure).not.toContain('bg-bg')
  })
})

describe('피커 시트 — 2a 프리미티브의 마지막 사용처였다 (#473)', () => {
  it('SurfaceList 를 쓰고 Row · RowList 를 import 하지 않는다', () => {
    expect(pickerSheet).toContain("import { SurfaceList } from '@/components/surface'")
    expect(pickerSheet).not.toMatch(/<RowList[\s/>]/)
    expect(pickerSheet).not.toMatch(/<Row[\s/>]/)
    expect(pickerSheet).toMatch(/<SurfaceList>/)
  })

  /*
    **구분선 규약이 행에서 목록으로 옮겨 갔다.** `SurfaceList` 의 `[&>li+li]` 가 항목
    사이에만 선을 그으므로 행 수를 아는 호출자가 아니어도 목록을 그릴 수 있다 — `last`
    가 남아 있으면 옮기다 만 것이다.
  */
  it('행이 자기 구분선을 그리지 않는다 — last 가 사라졌다', () => {
    expect(pickerSheet).not.toContain('last=')
    expect(pickerSheet).not.toContain('places.length - 1')
  })

  /*
    **선택 표시는 `--row-selected` 채움이다.** `Row` 의 `selected` 가 그리던 것이 이 tint
    하나였고(높이도 테두리도 건드리지 않는다), §0 이 금지하는 것은 아이템 **테두리**라
    채움은 그대로 옮겨도 규칙에 걸리지 않는다. 테두리로 바꾸면 목록이 들썩인다.
  */
  it('선택 행은 tint 로 표시한다 — 테두리를 두르지 않는다', () => {
    expect(pickerSheet).toContain("checked && 'bg-row-selected'")
    expect(pickerSheet).not.toMatch(/checked && '[^']*border/)
  })

  /*
    **시트 안 좌우 축이 하나다.** 기준 줄 · 안내 줄 · 스켈레톤 · 상태 · 행이 따로
    `px-4 md:px-6` 을 적고 있었고, 행만 옮기면 md 에서 세로선이 어긋난다.

    **그 한 값은 `card` 가 아니라 `panel` 이다** (`lib/ui/inset.ts` JSDoc). 시트는 md 이상에서
    `md:max-w-sm`(384) **고정 폭 컨테이너**이고 `md:` 는 언제나 **뷰포트** 기준이라,
    `card` 의 `md:px-5` 는 컨테이너 자신의 폭이 아니라 **화면 폭**을 보고 붙는다 —
    `BottomSheet` 자신의 머리와 footer 는 평평한 `px-4` 라 본문만 20 으로 밀린다
    (1280 실측: 시트 폭 384 · 제목과 푸터 16 · 목록 행만 20 으로 **4px 어긋남**).
    `card` 는 3층 표면 **안쪽 전용**이고 시트는 카드가 아니다 (§3-2 · radius 16 채널).
    저장소의 다른 시트 본문(`place-add-to-plan-sheet` · `map-sheet` ·
    `place-login-prompt-sheet`)도 전부 평평한 16 이고, `inset="panel"` 을 쓰는
    `emergency-map-view` 도 같은 이유(400px 고정 폭 패널)다.

    **값이 하나로 모였다는 것만 보면 틀린 축으로 모여도 통과한다.** 이 단언이 처음에
    `card` 를 잠그고 있었던 것이 지적의 핵심이라, `card` 가 한 자리도 남지 않았음을
    함께 본다.
  */
  it('시트 안 인셋을 INSET_CLASS.panel 한 값으로 모은다 — card 가 아니다', () => {
    expect(pickerSheet).not.toContain('md:px-6')
    expect(pickerSheet).not.toContain('INSET_CLASS.card')
    expect(pickerSheet).not.toContain('inset="card"')
    /*
      **#431 로 검색 탭이 열리며 자리가 늘었다.** `INSET_CLASS.panel` 넷 → 다섯(검색 폼
      한 줄), `inset="panel"` 둘 → 넷(검색 탭의 오류 · 0건). 개수를 잠그는 이유는
      **자리가 느는 쪽으로 드리프트가 나기 때문**이다 — 새 탭에 한 줄 더 붙이며 축을
      빠뜨리면 그 줄만 시트 머리와 어긋난다.
    */
    expect(pickerSheet.match(/INSET_CLASS\.panel/g)).toHaveLength(5)
    expect(pickerSheet.match(/inset="panel"/g)).toHaveLength(4)
  })

  /* 오버레이는 카드가 아니다 (§3-2 · radius 16 채널) — 시트 골격을 건드리지 않는다 */
  it('시트를 카드로 만들지 않는다', () => {
    expect(pickerSheet).not.toMatch(/<Surface[\s/>]/)
    expect(pickerSheet).toContain('<BottomSheet')
  })
})

/*
  **`2a 프리미티브는 더 이상 쓰이지 않는다` describe 를 지웠다** (#475). 그 블록은 `Band` ·
  `Section` · `Row` · `RowList` 를 JSX 로 쓰는 파일이 없다는 것을 `src`/`app` 전체
  `readdirSync` 워크로 확인했는데, 이 이슈가 네 export 를 `surface.tsx` 에서 실제로
  지우면서 **같은 계약을 `tsc` 가 먼저 잡는다** — 없는 이름을 import 하면 타입 에러다.
  워크 비용만 남아서 걷었다.
*/

describe('/ai-plans/jobs/[jobId] — 페이지는 바닥만 깐다 (#473)', () => {
  it('Canvas 를 쓰고 카드·폭을 뷰에 맡긴다', () => {
    expect(jobPage).toContain("import { Canvas } from '@/components/surface'")
    expect(jobPage).toContain('<Canvas as="main" id="main-content">')
    expect(jobPage).not.toContain('<SurfaceStack')
    expect(jobPage).not.toMatch(/<Surface[\s/>]/)
  })

  it('페이지가 폭·여백을 직접 잡지 않는다', () => {
    expect(jobPage).not.toContain('max-w-screen-md')
    expect(jobPage).not.toMatch(/<Canvas[^>]*\bp[xy]?-\d/)
  })

  /* 폴링 화면이라 서버 프리페치를 하지 않는다는 규약은 표면 전환으로 바뀌지 않는다 */
  it('서버 프리페치를 하지 않는다', () => {
    expect(jobPage).not.toContain('HydrationBoundary')
    expect(jobPage).not.toContain('getServerQueryClient')
  })
})

describe('/ai-plans/jobs/[jobId] — 여섯 상태가 한 카드에 든다 (#473)', () => {
  /*
    404 · 조회 오류 · 대기 · 작업 실패 · 취소 · 빈 초안. 완료만 `bare` 로 빠진다
    (초안 개요·일자 카드를 스스로 그리고 담기 패널은 카드 밖 L0 이다).
  */
  it('여섯 상태가 껍데기를 거치고 완료 둘만 bare 다', () => {
    expect(jobView.match(/<AiPlanJobShell>/g)).toHaveLength(6)
    expect(jobView.match(/<AiPlanJobShell bare>/g)).toHaveLength(2)
  })

  /*
    **`h1` 이 껍데기에 있다** (#451 판단). 상태마다 그리면 하나를 빠뜨렸을 때 문서의
    최상위 제목이 진행 표시의 `h2` 가 되어, 스크린리더 사용자가 무슨 화면인지 알 수 없다.
  */
  it('h1 이 껍데기에 한 번 있고 모든 상태가 그것을 공유한다', () => {
    expect(jobView.match(/<h1\b/g)).toHaveLength(1)
    expect(jobView).toContain('{messages.aiPlan.jobTitle}')
  })

  /* 머리는 카드가 아니다 (§0 판정) — 인셋만 카드 안 글줄과 같은 축이다 */
  it('머리가 카드 밖이고 인셋만 카드 축이다', () => {
    expect(jobView).toMatch(
      /<header className=\{cn\('pt-4 pb-4 md:pt-0 md:pb-0', INSET_CLASS\.card/,
    )
  })

  /* 머리가 이름을 이미 그리므로 카드는 `aria-label` 만 갖는다 */
  it('본문 카드는 aria-label 만 갖는다', () => {
    expect(jobView).toMatch(/<Surface aria-label=\{messages\.aiPlan\.jobTitle\}>/)
    expect(jobView.match(/<Surface[\s/>]/g)).toHaveLength(1)
  })

  it('카드 안 상태 컴포넌트가 전부 inset="card" 를 받는다', () => {
    // 404 · 빈 초안 · 조건 상실 셋이 EmptyState, 조회 오류가 ErrorState 다
    expect(jobView.match(/<EmptyState\s+inset="card"/g)).toHaveLength(3)
    expect(jobView.match(/<ErrorState\s+inset="card"/g)).toHaveLength(1)
    expect(jobView).toMatch(/<AiPlanProgress\s+inset="card"/)
    expect(jobView).toContain('inset="card"')
    expect(jobView).not.toContain('inset="main"')
  })
})

describe('완료 — 담기 패널은 카드 밖 L0 다 (#473)', () => {
  /*
    **`AiPlanDraftPreview` 의 `footer` prop 을 걷었다.** 미리보기가 카드 여럿이 되면서
    액션을 자기 아래에 그릴 자리가 사라졌다 — 배치는 담는 쪽이 갖는다 (#464 가 `PetForm`
    의 `footer` 를 걷은 것과 같은 이동).
  */
  it('미리보기가 footer 를 받지 않는다', () => {
    expect(code('src/features/ai-plan/ai-plan-draft-preview.tsx')).not.toContain('footer')
    expect(jobView).not.toContain('footer=')
  })

  /* 래퍼로 묶으면 카드 사이 간격을 스택이 주지 못한다 (#451 과 같은 이유) */
  it('미리보기 · 담기 패널 · 확인 모달이 스택의 직접 자식이다', () => {
    const bareBlock = jobView.slice(jobView.lastIndexOf('<AiPlanJobShell bare>'))

    expect(bareBlock).toContain('<AiPlanDraftPreview')
    expect(bareBlock).toContain('<AiPlanCommitPanel')
    expect(bareBlock).toContain('<ConfirmModal')
  })

  /*
    **액션이라 카드가 아니다** (§0 판정에서 "액션 바" 가 빠진다). 위 구분선도 걷는다 —
    3a 에서는 카드 사이 틈으로 비치는 L0 이 그 일을 하고, 선을 남기면 마지막 일자 카드의
    테두리와 나란히 두 줄로 읽힌다.
  */
  it('담기 패널이 카드도 구분선도 갖지 않고 인셋만 카드 축이다', () => {
    expect(commitPanel).not.toMatch(/<Surface[\s/>]/)
    expect(commitPanel).not.toContain('border-t')
    expect(commitPanel).not.toContain('md:px-10')
    expect(commitPanel).toContain("cn('flex flex-col gap-4 pb-4 md:pb-0', INSET_CLASS.card)")
  })

  /* 초안 항목은 카드 안 L2 다 — 구분선은 `SurfaceList` 가 항목 사이에만 긋는다 */
  it('초안 항목 행이 자기 구분선·페이지 인셋을 갖지 않는다', () => {
    expect(itemRow).toContain('INSET_CLASS.card')
    expect(itemRow).not.toContain('md:px-10')
    expect(itemRow).not.toContain('border-b')
  })
})

describe('AiPlanCanceled 의 inset 파라미터화 (#473)', () => {
  /*
    `AiPlanProgress` · `AiPlanFailed` 가 이미 가진 모양을 그대로 베낀다.
    **기본값은 형제 둘과 같은 `main` 이다** — 세 표시의 계약을 한 값으로 맞춰 둔다.
  */
  it('inset prop 을 받고 기본값이 main 이다', () => {
    expect(canceled).toContain('inset?: Inset')
    expect(canceled).toContain("inset = 'main'")
    expect(canceled).toContain('INSET_CLASS[inset]')
  })

  it('하드코딩 인셋이 남아 있지 않다', () => {
    expect(canceled).not.toContain('md:px-10')
  })
})
