/**
 * 라우트 상태 파일(`error.tsx` · `not-found.tsx` · `loading.tsx`)의 표면 계약 —
 * 이슈 #475 (#455 로드맵 12번).
 *
 * **소스를 문자열로 읽는다.** `error.tsx` 는 `reset` 콜백을 받는 클라이언트 경계고
 * `not-found.tsx` · `loading.tsx` 는 Next 가 세그먼트에 꽂는 규약 파일이라, node 환경에서
 * 라우트로서 렌더할 방법이 없다 (`testing-guide.md` §1). 여기서 지키려는 것도 렌더 결과가
 * 아니라 **표면 계약**이다 — 무엇이 바닥이고 무엇이 카드이며 인셋과 폭이 어느 값인가.
 * `ai-plan-surface.test.ts` · `plan-create-surface.test.ts` 와 같은 방식이다.
 *
 * **주석을 걷은 사본에 대해 단언한다.** 이 저장소의 주석은 근거를 길게 적어 클래스명·
 * 컴포넌트명이 주석 안에 그대로 등장한다 — 걷지 않으면 **주석 문자열에 속아 통과한다**
 * (#451 의 전례). `strip` 을 빼고 돌려 **실제로 확인한** 것만 적는다:
 *
 * - `md:px-10` — `mypage/error.tsx` 주석이 예전 값을 인용해 인셋 단언이 뒤집힌다.
 * - `ErrorState` · `onRetry` — `not-found.tsx` 셋의 주석이 "재시도 버튼을 쓰지 않는다" 를
 *   설명하며 두 이름을 적어, "재시도 경로가 없다" 가 뒤집힌다.
 * - **카드를 그리는 여덟의 `<Surface … title={messages.…}>`** — 여덟 파일의 주석이 정상
 *   화면의 열기 태그를 그대로 인용한다. 걷지 않으면 **카드를 지워도** 아래 "정상 화면과
 *   같은 카드를 그린다" 가 통과한다 (뮤테이션으로 확인).
 *
 * 백틱으로 감싼 `` `Surface` `` 는 `<` 가 없어 어떤 단언에도 걸리지 않고, `rail-layout` 은
 * 주석에 자주 나오지만 그 문자열을 보는 단언이 없다 — 걷지 않아도 아무것도 바뀌지 않는다.
 *
 * ### 여기서 잠그는 결정 셋
 *
 * 1. **카드 판정은 그 세그먼트의 정상 화면을 따른다.** 정상 화면이 상태(로딩·오류·빈)를
 *    카드에 담으면 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다 — `loading.tsx` 가
 *    "실화면과 같은 층으로 그린다" 를 고른 것과 같은 원리다. **판정 3문의 ③("담는 항목이
 *    둘 이상인가")을 "지금 담긴 자식 수" 로 읽지 않는다**: 그렇게 읽으면 정상 화면의
 *    카드들도 전부 카드가 아니어야 한다. ③ 은 그 면이 **화면의 답을 담는 역할인가**를
 *    묻는다. 그래서 카드와 그 이름표를 **정상 화면 쪽과 쌍으로** 단언한다 — 정상 화면이
 *    카드를 걷으면 경계 단언도 같이 깨져야 한다 (#464 폭 드리프트를 잡은 방식).
 * 2. **인셋은 `card`(16/20)다.** 카드 안이므로 카드 인셋이고, 카드가 없는 넷도 정상 화면의
 *    글줄과 같은 세로선에 서야 전환이 튀지 않는다 (#443 · #447 · #451 의 페이지 머리와
 *    같은 자리). 하드코딩 문자열 금지 — `md:px-6` 은 #386 이 걷은 폐기값이다.
 *    카드 없는 넷은 정상 화면 쪽이 `inset` 기본값 `main`(40) 에 캡도 없어 갈려 있었는데,
 *    **#480 이 경계 쪽(캡 + 44)으로 맞췄다** — 이 파일이 양쪽에 같은 단언을 걸어 잠근다.
 * 3. **폭은 그 세그먼트의 정상 화면에서 온다.** 정상 화면 쪽 값까지 함께 잠근다 —
 *    #464 가 반려견 폼을 512 → 672 로 넓혔을 때 `page.tsx` 만 따라가고 상태 파일 둘이
 *    `max-w-lg` 에 남아 있었다. 한쪽만 보는 단언은 그 드리프트를 못 잡는다.
 *
 * ### 여기에 없는 것 — `Canvas` 바닥 높이 (#456③ 에서 해결됐다)
 *
 * 상태 파일은 대개 한 화면을 못 채워 L0 회색이 콘텐츠 높이에서 끊기고 그 아래로 흰
 * 페이지가 보였다. **`min-h` 를 여기서 주지 않는다**는 판단은 그대로 유효하다 —
 * 레이아웃에 한 번 거는 규칙이고, 이미 3a 인 화면들(짧은 `/pets` · 빈 `/favorites`)도
 * 같은 증상이라 이 이슈가 만든 문제가 아니었다. 상태 파일에만 달면 같은 규칙이 열두
 * 곳으로 갈린다. (#475 본문이 "겹치면 #456 을 먼저 하는 편이 나을 수 있다 — 착수 전에
 * 판단해라" 를 요구한 것에 대한 답이 이 문단이다.)
 *
 * **#456③ 이 그 규칙을 `app/(main)/layout.tsx` 한 곳에 놓았다** —
 * `src/components/main-layout-surface.test.ts` 가 잠근다. 열둘 중 어느 파일도 높이를
 * 스스로 정하지 않으므로 이 파일은 그대로다.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** 블록 주석과 줄 주석을 걷은 소스 — 계약은 코드에만 있다 */
function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function code(relative: string): string {
  return strip(readFileSync(`${ROOT}${relative}`, 'utf8'))
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `<EmptyState …>` · `<ErrorState …>` 의 **열기 태그**를 하나씩 집는다 (여러 줄).
 *
 * **정규식으로 하지 않는다** — `[\s\S]*?\/>` 는 `action={<PlaceBackLink />}` 처럼 prop 안에
 * 든 self-closing 자식의 `/>` 에서 잘린다. 상세 화면의 404·400 갈래가 바로 그 모양이라
 * 여기서는 실제로 잘린다. 중괄호 깊이를 세며 깊이 0 의 `>` 까지 걷는다.
 *
 * `state-heading-level.test.ts` 에 같은 것이 있다 — **#458** 이 이런 소스 단언 헬퍼를
 * `src/test` 로 승격하는 이슈이고, 그때 한 곳으로 모은다.
 */
function stateTags(source: string): string[] {
  const tags: string[] = []

  for (const start of [...source.matchAll(/<(?:Empty|Error)State\b/g)].map((m) => m.index)) {
    let depth = 0
    let quote: string | null = null

    for (let i = start; i < source.length; i += 1) {
      const char = source[i] as string

      if (quote !== null) {
        if (char === quote) quote = null
        continue
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char
        continue
      }
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth === 0) {
        tags.push(source.slice(start, i + 1))
        break
      }
    }
  }

  return tags
}

/**
 * `<Surface … {probe} …>` 의 열기 태그를 찾는다.
 *
 * `[^>]*` 는 줄바꿈도 먹으므로 여러 줄로 쓴 열기 태그에 그대로 걸린다 — 정상 화면은
 * prop 을 줄마다 쓰고 경계 파일은 한 줄로 쓰지만 **같은 정규식이 둘 다 문다.**
 */
function surfaceTag(probe: string): RegExp {
  return new RegExp(`<Surface\\b[^>]*${escapeRegExp(probe)}`)
}

/**
 * 카드 판정 — **정상 화면이 소유한다.**
 *
 * `kind: 'card'` 는 정상 화면이 상태를 `Surface` 안에서 그리는 세그먼트다. `probes` 는
 * 그 카드의 이름표와 `lead` 여부이고, **경계 파일과 정상 화면에 똑같이 단언한다.**
 *
 * `kind: 'none'` 은 정상 화면이 상태를 L0 위에 바로 그리는 세그먼트다. 정상 화면 쪽은
 * "상태 컴포넌트를 감싸지 않고 그대로 반환한다" 로 잠근다 — 거기에 `Surface` 가 끼면
 * 이 단언이 먼저 깨지고, 그때 경계도 함께 옮긴다.
 */
type CardContract =
  | {
      kind: 'card'
      /** 열기 태그 안에 있어야 하는 조각들 — 이름표는 정상 화면과 **같은 `messages` 키** */
      probes: string[]
      /**
       * 이름표가 **없는** 카드다 (`<Surface>` 민짜). `probes` 로는 표현할 수 없어
       * 따로 표시하고 전용 단언이 짝을 잠근다 — 비밀번호 변경 하나가 그렇다.
       */
      nameless?: true
      /** 이름표의 출처 */
      source: string
    }
  | { kind: 'none'; source: string }

type StateFile = {
  /** 라우트 상태 파일 */
  path: string
  /** `SurfaceStack` 에 붙는 폭 클래스 (`content-container` 는 1440 캡) */
  width: string
  /** 상태 컴포넌트 — 404 는 `EmptyState`(재시도 없음), 일시 장애는 `ErrorState` */
  state: 'EmptyState' | 'ErrorState'
  /** 폭의 출처가 되는 정상 화면 소스와 거기 있어야 하는 값 */
  widthSource: { path: string; contains: string }
  /**
   * 이 경계의 `h1` 이 쓰는 `messages` 키 — **정상 화면의 `h1` 과 같아야 하는 경우에만** 준다.
   *
   * 아홉이 그렇다. 나머지 다섯은 정상 화면 쪽 `page.tsx` 에 `h1` 이 없어 비교 대상이
   * 없다: 상세 넷(`places/[placeId]` · `plans/[planId]`)은 경계가 **오류 전용 이름**
   * (`detailErrorTitle` · `detailNotFoundTitle`)을 쓰고, AI 작업 상태는 `h1` 을
   * 뷰 컴포넌트가 그린다. 그쪽은 화면 이름을 물려받는 계약이 아니다.
   *
   * **#481 이 이 필드를 요구했다.** 마이페이지 경계 하나가 셋을 덮던 시절, 폼 화면에서
   * 예외가 뜨면 문서 최상위 제목이 `내 정보` 로 바뀌었다 — 폭보다 이쪽이 더 나쁘다.
   * 폭만 잠근 단언은 그 증상을 못 잡았다 (뮤테이션으로 확인).
   */
  heading?: string
  card: CardContract
}

/**
 * **`rail-layout` 인 세 화면은 `content-container` 를 쓴다.** 정상 화면은 좌 레일 +
 * 우 본문 2단이지만 예외 화면에는 레일이 없고, grid 를 그대로 쓰면 내용이 첫 열
 * (`/places` 는 280, 상세 둘은 400)에 갇힌다. `globals.css` 가
 * `.content-container, .rail-layout` 한 규칙으로 1440 캡과 가운데 정렬을 공유하므로,
 * grid 절반만 빼면 컨테이너는 정확히 같다 (아래 별도 단언).
 */
const STATE_FILES: StateFile[] = [
  {
    path: 'app/(main)/ai-plans/jobs/[jobId]/error.tsx',
    width: 'mx-auto w-full max-w-screen-md',
    state: 'ErrorState',
    widthSource: { path: 'src/features/ai-plan/ai-plan-job-view.tsx', contains: 'max-w-screen-md' },
    /* `AiPlanJobShell` 이 여섯 갈래를 카드 하나에 담는다. 머리의 `h1` 이 이름을 이미
       그리므로 카드는 `aria-label` 만 갖는다 — 경계도 같은 키를 같은 자리에 쓴다 */
    card: {
      kind: 'card',
      probes: ['aria-label={messages.aiPlan.jobTitle}'],
      source: 'src/features/ai-plan/ai-plan-job-view.tsx',
    },
  },
  {
    path: 'app/(main)/ai-plans/new/error.tsx',
    heading: 'messages.aiPlan.createTitle',
    width: 'mx-auto w-full max-w-2xl',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/ai-plans/new/page.tsx', contains: 'max-w-2xl' },
    /* `AiPlanCreateSurface` 가 네 상태를 카드 하나에 담는다 — 그 카드가 화면의 껍데기다 */
    card: {
      kind: 'card',
      probes: ['lead', 'title={messages.aiPlan.createTitle}'],
      source: 'src/features/ai-plan/ai-plan-create-view.tsx',
    },
  },
  {
    path: 'app/(main)/favorites/error.tsx',
    heading: 'messages.favorite.listTitle',
    width: 'content-container',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/favorites/page.tsx', contains: 'content-container' },
    card: {
      kind: 'card',
      probes: ['lead', 'title={messages.favorite.listTitle}'],
      source: 'src/features/favorite/favorite-list-section.tsx',
    },
  },
  {
    path: 'app/(main)/mypage/error.tsx',
    heading: 'messages.member.myPageTitle',
    width: 'mx-auto w-full max-w-screen-md',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/mypage/(root)/page.tsx', contains: 'max-w-screen-md' },
    card: {
      kind: 'card',
      probes: ['lead', 'title={messages.member.myPageTitle}'],
      source: 'src/features/member/my-page-sections.tsx',
    },
  },
  /*
    **마이페이지 세그먼트는 경계가 셋이다** (#481). 예전에는 위 하나가 셋을 덮었는데
    폭도 `h1` 도 루트 기준이라, 두 폼 화면에서 예외가 뜨면 글줄이 768 로 넓어지고
    문서의 이름이 `내 정보` 로 바뀌었다. 셋을 **각자 자기 정상 화면과 쌍으로** 잠근다.

    **둘의 카드 이름표가 갈리는 것이 의도다.** 탈퇴는 `WithdrawView` 가 제목 있는 카드를
    그리므로 같은 키를 쓰고, 비밀번호는 `PasswordView` 의 **오류 갈래**가 이름 없는
    `<Surface>` 다 — 성공 갈래 제목(`setup ? passwordSetup : passwordChange`)이 응답을
    봐야 정해지는데 경계에는 그 응답이 없다. 정상 화면이 오류에서 제목을 뺀 이유가
    그것이고 경계도 같은 자리에 선다.
  */
  {
    path: 'app/(main)/mypage/password/error.tsx',
    heading: 'messages.member.passwordTitle',
    width: 'mx-auto w-full max-w-2xl',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/mypage/password/page.tsx', contains: 'max-w-2xl' },
    card: {
      kind: 'card',
      /*
        **이름 없는 카드다.** `probes` 가 비면 위 루프가 아무것도 단언하지 않아 짝이
        공허해지므로, 아래 `이름 없는 카드도 정상 화면과 짝을 이룬다` 가 대신 잠근다.
      */
      probes: [],
      nameless: true,
      source: 'src/features/member/password-view.tsx',
    },
  },
  {
    path: 'app/(main)/mypage/withdraw/error.tsx',
    heading: 'messages.member.withdrawTitle',
    width: 'mx-auto w-full max-w-2xl',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/mypage/withdraw/page.tsx', contains: 'max-w-2xl' },
    card: {
      kind: 'card',
      probes: ['lead', 'title={messages.member.withdrawTitle}'],
      source: 'src/features/member/withdraw-view.tsx',
    },
  },
  {
    path: 'app/(main)/pets/error.tsx',
    heading: 'messages.pet.listTitle',
    width: 'mx-auto w-full max-w-screen-md',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/pets/page.tsx', contains: 'max-w-screen-md' },
    card: {
      kind: 'card',
      probes: ['lead', 'title={messages.pet.listTitle}'],
      source: 'src/features/pet/pet-list-section.tsx',
    },
  },
  {
    path: 'app/(main)/pets/[petId]/error.tsx',
    heading: 'messages.pet.editTitle',
    width: 'mx-auto w-full max-w-2xl',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/pets/[petId]/page.tsx', contains: 'max-w-2xl' },
    /* `PetEditView` 의 조회 실패 갈래가 카드를 그린다 — 이 화면의 카드는 보이는 제목
       줄이 없어 이름표가 `aria-label` 이다 */
    card: {
      kind: 'card',
      probes: ['aria-label={messages.pet.editTitle}'],
      source: 'src/features/pet/pet-edit-view.tsx',
    },
  },
  {
    path: 'app/(main)/pets/[petId]/not-found.tsx',
    heading: 'messages.pet.editTitle',
    width: 'mx-auto w-full max-w-2xl',
    state: 'EmptyState',
    widthSource: { path: 'app/(main)/pets/[petId]/page.tsx', contains: 'max-w-2xl' },
    card: {
      kind: 'card',
      probes: ['aria-label={messages.pet.editTitle}'],
      source: 'src/features/pet/pet-edit-view.tsx',
    },
  },
  {
    path: 'app/(main)/places/(list)/error.tsx',
    heading: 'messages.place.pageTitle',
    width: 'content-container',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/places/(list)/page.tsx', contains: 'rail-layout' },
    card: {
      kind: 'card',
      probes: ['lead', 'title={messages.place.pageTitle}'],
      source: 'app/(main)/places/(list)/page.tsx',
    },
  },
  {
    path: 'app/(main)/places/[placeId]/error.tsx',
    width: 'content-container',
    state: 'ErrorState',
    widthSource: { path: 'src/features/place/place-detail-section.tsx', contains: 'rail-layout' },
    card: { kind: 'none', source: 'src/features/place/place-detail-section.tsx' },
  },
  {
    path: 'app/(main)/places/[placeId]/not-found.tsx',
    width: 'content-container',
    state: 'EmptyState',
    widthSource: { path: 'src/features/place/place-detail-section.tsx', contains: 'rail-layout' },
    card: { kind: 'none', source: 'src/features/place/place-detail-section.tsx' },
  },
  {
    path: 'app/(main)/plans/[planId]/error.tsx',
    width: 'content-container',
    state: 'ErrorState',
    widthSource: { path: 'src/features/plan/plan-detail-section.tsx', contains: 'rail-layout' },
    card: { kind: 'none', source: 'src/features/plan/plan-detail-view.tsx' },
  },
  {
    path: 'app/(main)/plans/[planId]/not-found.tsx',
    width: 'content-container',
    state: 'EmptyState',
    widthSource: { path: 'src/features/plan/plan-detail-section.tsx', contains: 'rail-layout' },
    card: { kind: 'none', source: 'src/features/plan/plan-detail-view.tsx' },
  },
]

const CARDED = STATE_FILES.filter((file) => file.card.kind === 'card')
const UNCARDED = STATE_FILES.filter((file) => file.card.kind === 'none')

type LoadingFile = {
  path: string
  /**
   * **가로 배치는 정상 화면과 같아야 한다.** 형제 셋은 폭을 `SurfaceStack` 에 주지만
   * `/places` 는 2단이라 폭·캡이 `Canvas` 의 grid 에 있다 — 어느 쪽이든 **정상 화면과
   * 같은 클래스를 같은 자리에** 건다. 어긋나면 로딩이 끝나는 순간 카드가 옆으로 뛴다.
   */
  layout: { on: 'Canvas' | 'SurfaceStack'; className: string }
  /** 그 배치의 출처가 되는 정상 화면 */
  layoutSource: string
}

/** 실화면의 카드를 흉내 내므로 **정상 화면과 같은 카드를 그린다** */
const LOADING_FILES: LoadingFile[] = [
  {
    path: 'app/(main)/favorites/loading.tsx',
    layout: { on: 'SurfaceStack', className: 'content-container' },
    layoutSource: 'app/(main)/favorites/page.tsx',
  },
  {
    path: 'app/(main)/mypage/(root)/loading.tsx',
    layout: { on: 'SurfaceStack', className: 'mx-auto w-full max-w-screen-md' },
    layoutSource: 'app/(main)/mypage/(root)/page.tsx',
  },
  {
    path: 'app/(main)/pets/loading.tsx',
    layout: { on: 'SurfaceStack', className: 'mx-auto w-full max-w-screen-md' },
    layoutSource: 'app/(main)/pets/page.tsx',
  },
  {
    path: 'app/(main)/places/(list)/loading.tsx',
    layout: { on: 'Canvas', className: 'rail-layout rail-layout-filter' },
    layoutSource: 'app/(main)/places/(list)/page.tsx',
  },
]

describe('라우트 상태 파일이 3층 표면 위에 선다 (#475)', () => {
  it.each(STATE_FILES)('$path — Canvas 가 main 이고 바닥을 깐다', ({ path }) => {
    const source = code(path)

    expect(source).toContain("from '@/components/surface'")
    expect(source).toContain('<Canvas as="main" id="main-content">')
    /* 2a 흰 페이지의 흔적 — `<main className="mx-auto max-w-… px-4 py-6 …">` */
    expect(source).not.toMatch(/<main[\s>]/)
  })

  it.each(STATE_FILES)(
    '$path — 폭이 Canvas 가 아니라 SurfaceStack 에 붙는다',
    ({ path, width }) => {
      const source = code(path)

      expect(source).toContain(`<SurfaceStack className="${width}">`)
      /* 바닥은 전폭이어야 한다 (§0) — 폭이 `Canvas` 로 올라가면 컨테이너 바깥이 흰색으로 남는다 */
      expect(source).not.toMatch(/<Canvas[^>]*(max-w-|content-container)/)
    },
  )

  /*
    **인셋은 `main`(16/40)이 아니라 `card`(16/20)다.** `md:px-6` 은 #386 이 걷은
    폐기값이라 한 자리도 남으면 안 된다.
  */
  it.each(STATE_FILES)('$path — 상태 컴포넌트가 inset="card" 를 받는다', ({ path, state }) => {
    const source = code(path)

    expect(source).toMatch(new RegExp(`<${state}\\b[^>]*inset="card"`, 's'))
    expect(source).not.toContain('inset="main"')
    expect(source).not.toContain('md:px-6')
    expect(source).not.toContain('md:px-10')
    expect(source).not.toContain('md:py-8')
  })

  /*
    **`h1` 이 없으면 문서의 최상위 제목이 상태 컴포넌트의 `h2` 가 된다** (#451 · #473 이
    같은 이유로 `h1` 을 세웠다). 보이는 제목은 그 `h2` 가 이미 그리므로 `sr-only` 다 —
    `loading.tsx` 넷과 같은 방식이고, 같은 말이 두 번 들리는 거래는 #453 · #473 이
    이미 받아들였다.
  */
  it.each(STATE_FILES)('$path — h1 이 sr-only 로 하나 선다', ({ path }) => {
    const source = code(path)

    expect(source.match(/<h1\b/g)).toHaveLength(1)
    expect(source).toContain('<h1 className="sr-only">')
  })

  /*
    **404 에 재시도 버튼을 붙이지 않는다** (`frontend/CLAUDE.md` 절대 규칙 ·
    `api-integration-guide.md` §3). `EmptyState` 에 `onRetry` 슬롯이 없다는 것과 별개로,
    상태 파일이 `ErrorState` 를 잘못 고르면 버튼이 되살아난다.
  */
  it.each(STATE_FILES.filter((file) => file.path.endsWith('not-found.tsx')))(
    '$path — 재시도 경로가 없다',
    ({ path }) => {
      const source = code(path)

      expect(source).not.toContain('ErrorState')
      expect(source).not.toContain('onRetry')
      expect(source).not.toContain("'use client'")
    },
  )

  it.each(STATE_FILES.filter((file) => file.path.endsWith('error.tsx')))(
    '$path — 재시도가 reset 을 부른다',
    ({ path }) => {
      const source = code(path)

      expect(source).toContain("'use client'")
      expect(source).toContain('onRetry={reset}')
    },
  )
})

/*
  **`h1` 은 화면의 이름이다 — 경계가 그것을 바꾸면 안 된다** (#481).

  마이페이지 경계 하나가 세그먼트 셋을 덮던 시절, 비밀번호를 바꾸던 중 예외가 나면
  문서 최상위 제목이 `내 정보` 로 바뀌었다. 스크린리더에는 지금 어느 화면에서 실패했는지가
  **폭보다 먼저** 전해진다. 폭만 잠근 단언은 그 증상을 못 잡는다 — 뮤테이션으로 확인했다
  (`h1` 키를 루트 값으로 되돌려도 122개가 전부 초록이었다).

  아홉만 본다. 나머지 다섯은 정상 화면 `page.tsx` 에 `h1` 이 없어 비교 대상이 없다.
*/
describe('h1 이 정상 화면의 이름과 같다 (#481)', () => {
  const NAMED = STATE_FILES.filter((entry) => entry.heading !== undefined)

  // 표가 줄면 단언도 조용히 줄어든다 — 개수를 박아 그것을 막는다
  it('아홉이 이 계약을 갖는다', () => {
    expect(NAMED).toHaveLength(9)
  })

  it.each(NAMED)(
    '$path — 정상 화면과 같은 messages 키를 h1 에 쓴다',
    ({ path, heading, widthSource }) => {
      const key = heading as string
      const h1 = new RegExp(`<h1[^>]*>\\{${key.replace(/\./g, '\\.')}\\}</h1>`)

      expect(code(path)).toMatch(h1)
      /* 짝의 반대쪽 — 정상 화면이 이름을 바꾸면 경계도 따라와야 한다 */
      expect(code(widthSource.path)).toMatch(h1)
    },
  )
})

/**
 * **카드 판정은 그 세그먼트의 정상 화면이 소유한다** (#475).
 *
 * 정상 화면이 상태를 카드에 담으면 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다.
 * **그래서 양쪽에 같은 단언을 건다** — 정상 화면이 카드를 걷거나 이름표를 바꾸면 경계
 * 단언이 같이 깨져야 한다. 한쪽만 보는 단언이 #464 폭 드리프트를 놓친 방식이다.
 */
describe('카드 판정이 정상 화면과 쌍을 이룬다 (#475)', () => {
  it.each(CARDED)('$path — 정상 화면과 같은 카드를 그린다', ({ path, card }) => {
    if (card.kind !== 'card') throw new Error('unreachable')

    const boundary = code(path)
    const normal = code(card.source)

    for (const probe of card.probes) {
      expect(boundary).toMatch(surfaceTag(probe))
      /* 이름표의 출처 — 여기가 깨지면 경계가 아니라 정상 화면이 움직인 것이다 */
      expect(normal).toMatch(surfaceTag(probe))
    }
  })

  /*
    **이름 없는 카드도 정상 화면과 짝을 이룬다** (#481). `probes` 가 비어 위 루프가
    건너뛰는 자리를 여기서 메운다 — 한쪽이 이름을 갖게 되면 깨져야 한다.

    비밀번호 변경이 그렇다: 성공 갈래의 카드 제목은
    `setup ? passwordSetup : passwordChange` 로 **응답을 봐야 정해지는데** 경계에는 그
    응답이 없다. 정상 화면이 오류 갈래에서 제목을 뺀 이유가 그것이고, 경계도 같은 자리에
    선다. 양쪽 다 **민짜 `<Surface>` 가 상태를 감싼다** 로 잠근다.
  */
  it.each(CARDED.filter((entry) => entry.card.kind === 'card' && entry.card.nameless === true))(
    '$path — 이름 없는 카드도 정상 화면과 짝을 이룬다',
    ({ path, card, state }) => {
      if (card.kind !== 'card') throw new Error('unreachable')

      const bare = new RegExp(`<Surface>\\s*<${state}\\b`)

      expect(code(path)).toMatch(bare)
      /* 짝의 반대쪽 — 정상 화면이 이름을 갖게 되면 경계도 함께 옮겨야 한다 */
      expect(code(card.source)).toMatch(bare)
    },
  )

  /*
    **`Surface` 가 상태 컴포넌트를 실제로 감싼다.** 열기 태그만 보면 카드를 그려 놓고
    상태를 그 밖에 둬도 통과한다.
  */
  it.each(CARDED)('$path — 상태 컴포넌트가 그 카드 안에 있다', ({ path, state }) => {
    expect(code(path)).toMatch(new RegExp(`<Surface\\b[^>]*>[\\s\\S]*<${state}\\b`))
  })

  /*
    정상 화면이 상태를 **카드에 담지 않는다** — `PlaceDetailSection` · `PlanDetailView` 는
    404 · 400 · 5xx 를 L0 위에 바로 그린다. 양쪽 다 `Surface` 가 없어야 하고, 어느 한쪽에
    끼면 그때 넷을 함께 카드로 옮긴다.

    **`Surface` 만 본다 — `SurfaceStack` 은 카드가 아니라 카드 열이다.** #480 이 화면 안
    갈래를 경계와 같은 축(`content-container` + `card` 인셋)에 세우면서 양쪽 다
    `SurfaceStack` 을 쓰게 됐다. `/<Surface[\s/>]/` 가 `<SurfaceStack` 을 물지 않는 것은
    `S` 가 `[\s/>]` 에 없기 때문이고, 그 우연에 기대지 않으려고 단어 경계로 못박는다.
  */
  it.each(UNCARDED)('$path — 정상 화면이 카드를 쓰지 않으므로 경계도 쓰지 않는다', (file) => {
    const noCard = /<Surface\b(?!Stack|List)/

    expect(code(file.path)).not.toMatch(noCard)

    /*
      **정상 화면 쪽은 파일 전체를 볼 수 없다** — 상세 화면의 성공 갈래는 카드를 여럿
      쓴다. 보는 것은 **상태 갈래**다: `DetailStateShell` 이 감싸고 그 껍데기 안에
      카드가 없어야 한다. 예전에는 `return (<EmptyState` 로 "그대로 반환한다" 를
      단언했는데, #480 이 축을 맞추려고 껍데기를 씌우면서 그 모양이 바뀌었다.
    */
    const normal = code(file.card.source)
    expect(normal).toMatch(new RegExp(`<DetailStateShell\\b[^>]*>\\s*<${file.state}\\b`))

    /* 껍데기 **함수 하나**로 자른다 — 파일 끝까지 자르면 뒤따르는 헬퍼의 카드가 섞인다 */
    const from = normal.indexOf('function DetailStateShell')
    const shell = normal.slice(from, normal.indexOf('\n}\n', from))

    expect(shell).toContain('<SurfaceStack className="content-container">')
    expect(shell).not.toMatch(noCard)
  })

  /*
    **같은 404·오류가 "누가 잡았는가" 에 따라 다른 축에 서지 않는다** (#480).

    서버가 404 를 잡으면 경계가, 화면 안 재조회가 잡으면 정상 화면의 갈래가 뜬다. 예전에는
    경계만 `content-container`(1440 캡) + `card` 인셋이고 화면 안 갈래는 **캡도 없고 인셋도
    기본값 `main`(40)** 이었다 — 1920 에서 글줄이 화면 왼쪽 끝에 붙었다.
    `error-state.tsx` 의 `inset` 주석이 막으려던 모양 그대로다.

    **양쪽에 같은 단언을 건다.** 한쪽만 보면 다시 갈린다 — 그것이 이 이슈가 생긴 방식이다.
  */
  it.each(UNCARDED)('$path — 화면 안 갈래와 같은 축에 선다 (#480)', (file) => {
    for (const source of [code(file.path), code(file.card.source)]) {
      expect(source).toContain('content-container')
      /* 폐기값이다 — #386 이 걷었고 40 은 카드 안에서 두 번 밀린다 */
      expect(source).not.toContain('md:px-10')

      /*
        **갈래마다 본다.** 파일에 `inset="card"` 가 하나라도 있으면 통과하는 단언은
        셋 중 하나가 빠져도 못 잡는다 — 뮤테이션으로 확인했다. 이 이슈가 생긴 방식이
        정확히 그것이다: 화면 안 갈래 **다섯이** `inset` 을 안 넘겨 기본값 `main`(40)에 섰다.
      */
      const tags = stateTags(source)
      expect(tags.length).toBeGreaterThan(0)
      for (const tag of tags) {
        expect(tag).toContain('inset="card"')
      }
    }
  })

  /*
    **`h1` 이 사라지지 않는다** (#480). 화면 안 갈래는 정상 화면 트리에 닿기 전에 반환하므로
    예전에는 **문서에 `h1` 이 하나도 없었다** — 서버가 잡았을 때만 경계가 `sr-only h1` 을
    그렸다. 같은 실패인데 한쪽에서만 문서에 이름이 있었다.
  */
  it.each(UNCARDED)('$path — 화면 안 갈래도 sr-only h1 을 그린다 (#480)', (file) => {
    expect(code(file.card.source)).toMatch(/<h1 className="sr-only">/)
  })
})

/**
 * **폭은 정상 화면에서 온다.** 한쪽만 보는 단언은 드리프트를 못 잡는다 — #464 가 반려견
 * 폼을 512 → 672 로 넓혔을 때 `page.tsx` 만 따라갔고 상태 파일 둘은 `max-w-lg` 에 남았다.
 */
describe('상태 파일의 폭이 그 세그먼트의 정상 화면과 같다 (#475)', () => {
  it.each(STATE_FILES)('$path ← $widthSource.path', ({ widthSource }) => {
    expect(code(widthSource.path)).toContain(widthSource.contains)
  })

  /*
    `rail-layout` 화면 셋이 `content-container` 로 갈아타는 근거다. 두 클래스가 한 규칙을
    공유하므로 grid 절반만 빼면 컨테이너(1440 캡 + 가운데 정렬)는 정확히 같다.
    이 규칙이 갈라지면 예외 화면의 왼쪽 기준선이 정상 화면과 어긋난다.
  */
  it('content-container 와 rail-layout 이 같은 캡 규칙을 공유한다', () => {
    const globals = readFileSync(`${ROOT}app/globals.css`, 'utf8')

    expect(globals).toMatch(
      /\.content-container,\s*\n\.rail-layout\s*\{[^}]*max-inline-size:\s*var\(--content-max\)/,
    )
  })
})

/**
 * **로딩 폴백 넷은 실화면의 카드를 흉내 낸다.**
 *
 * `places/(list)/loading.tsx` 만 `as="main"` · `h1` · `INSET_CLASS` · 가로 배치 넷 다
 * 빠져 있었다 (#475 에서 맞췄다). 가로 배치가 어긋나면 로딩이 끝나는 순간 카드가 옆으로
 * 뛴다 — lg 에서 정상 화면의 목록은 `--rail-filter`(280) 다음부터 시작한다.
 */
describe('로딩 폴백은 실화면과 같은 층·같은 자리로 그린다 (#475)', () => {
  it.each(LOADING_FILES)('$path — main 랜드마크와 h1 이 폴백 중에도 선다', ({ path }) => {
    const source = code(path)

    expect(source).toContain('<Canvas as="main" id="main-content"')
    expect(source).toContain('<h1 className="sr-only">')
  })

  it.each(LOADING_FILES)('$path — 카드를 그리고 인셋은 INSET_CLASS 참조다', ({ path }) => {
    const source = code(path)

    expect(source).toMatch(/<Surface[\s/>]/)
    expect(source).toContain('INSET_CLASS.card')
    expect(source).not.toContain('md:px-5"')
    expect(source).not.toContain('md:px-6')
  })

  it.each(LOADING_FILES)(
    '$path — 가로 배치가 $layoutSource 와 같다',
    ({ path, layout, layoutSource }) => {
      const opening =
        layout.on === 'Canvas'
          ? `<Canvas as="main" id="main-content" className="${layout.className}">`
          : `<SurfaceStack className="${layout.className}">`

      expect(code(path)).toContain(opening)
      expect(code(layoutSource)).toContain(opening)
    },
  )
})
