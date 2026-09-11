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
 *    카드 없는 넷은 정상 화면 쪽이 `inset` 기본값 `main`(40) 에 캡도 없어 아직 갈리는데,
 *    어느 쪽으로 맞출지는 **#480** 이 정한다 (이 파일의 범위 밖).
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
    width: 'mx-auto w-full max-w-screen-md',
    state: 'ErrorState',
    widthSource: { path: 'app/(main)/mypage/(root)/page.tsx', contains: 'max-w-screen-md' },
    card: {
      kind: 'card',
      probes: ['lead', 'title={messages.member.myPageTitle}'],
      source: 'src/features/member/my-page-sections.tsx',
    },
  },
  {
    path: 'app/(main)/pets/error.tsx',
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
    **`Surface` 가 상태 컴포넌트를 실제로 감싼다.** 열기 태그만 보면 카드를 그려 놓고
    상태를 그 밖에 둬도 통과한다.
  */
  it.each(CARDED)('$path — 상태 컴포넌트가 그 카드 안에 있다', ({ path, state }) => {
    expect(code(path)).toMatch(new RegExp(`<Surface\\b[^>]*>[\\s\\S]*<${state}\\b`))
  })

  /*
    정상 화면이 상태를 **감싸지 않고 그대로 반환한다** — `PlaceDetailSection` ·
    `PlanDetailView` 는 404 · 400 · 5xx 를 L0 위에 바로 그린다. 여기에 `Surface` 가 끼면
    이 단언이 먼저 깨지고, 그때 경계 넷도 함께 카드로 옮긴다.
  */
  it.each(UNCARDED)('$path — 정상 화면이 카드를 쓰지 않으므로 경계도 쓰지 않는다', (file) => {
    expect(code(file.path)).not.toMatch(/<Surface[\s/>]/)
    expect(code(file.card.source)).toMatch(new RegExp(`return \\(\\s*<${file.state}\\b`))
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
