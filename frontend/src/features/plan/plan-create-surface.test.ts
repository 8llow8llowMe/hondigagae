/**
 * 일정 만들기 화면이 3층 표면 위에 선다 — 이슈 #453.
 *
 * **소스를 문자열로 읽는다.** `PlanCreateView` 는 `usePetList` · `useForm` · `useRouter` 가
 * 걸려 있어 node 환경에서 렌더되지 않고(`testing-guide.md` §1), 페이지는 서버 컴포넌트다.
 * 여기서 지키려는 것은 렌더 결과가 아니라 **표면 계약**이다 — 무엇이 바닥이고 무엇이
 * 카드이며 인셋이 어느 값인가. `emergency-list-view.test.ts` · `site-footer.test.ts` ·
 * `plan-add-place.test.ts` 가 쓰는 방식과 같다.
 *
 * **주석을 걷은 사본에 대해 단언한다.** 이 저장소의 주석은 근거를 길게 적으므로 클래스명·
 * 컴포넌트명이 주석 안에 그대로 등장한다 — 걷지 않으면 **주석 문자열에 속아 통과한다**
 * (#451 의 전례). 반대로 "없어야 한다" 는 단언은 걷지 않으면 주석 때문에 실패한다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as code } from '@/test/source'

/** 블록 주석과 줄 주석을 걷은 소스 — 계약은 코드에만 있다 */

const page = code('app/(main)/plans/new/page.tsx')
const view = code('src/features/plan/plan-create-view.tsx')

describe('페이지가 바닥과 쌓기를 가른다 (#453)', () => {
  it('Canvas 와 SurfaceStack 을 import 한다 — 2a 프리미티브를 쓰지 않는다', () => {
    expect(page).toContain("import { Canvas, SurfaceStack } from '@/components/surface'")
    expect(page).toContain('<Canvas as="main" id="main-content">')
    expect(page).toContain('<SurfaceStack')
  })

  /*
    바닥은 전폭이어야 한다 (§0). 폭 제한이 `Canvas` 쪽에 붙으면 1440 컨테이너 바깥이
    흰색으로 남는다 — 예전 `main` 이 `mx-auto max-w-2xl` 로 그 둘을 겸하고 있었다.
  */
  it('max-w-2xl 이 Canvas 가 아니라 SurfaceStack 에 붙는다', () => {
    expect(page).toMatch(/<SurfaceStack className="[^"]*max-w-2xl/)
    expect(page).not.toMatch(/<Canvas[^>]*max-w-/)
  })

  /* 세로·좌우 여백은 `SurfaceStack` 이 준다 — 페이지가 다시 주면 두 번 밀린다 */
  it('페이지가 자기 페이지 인셋을 다시 주지 않는다', () => {
    expect(page).not.toMatch(/<Canvas[^>]*\bp[xy]?-\d/)
    expect(page).not.toMatch(/<SurfaceStack className="[^"]*\bp[xy]?-\d/)
  })

  /*
    **액션은 카드가 아니다** (§0 판정에서 "액션 바" 가 빠진다 — 장소 상세 #443 ·
    일정 상세 #447). 취소 링크는 카드 밖 L0 바닥 위에 선다.

    **페이지가 카드를 아예 그리지 않는 것으로 잠근다.** 링크가 카드 안으로 들어가는
    경로는 페이지가 `Surface` 를 그리기 시작할 때 열리는데(카드를 뷰가 그리는 지금은
    링크를 감쌀 카드가 페이지에 없다), 링크의 위치를 직접 재는 단언은 node 환경에서
    쓸 수 없다 — 뷰가 훅 때문에 렌더되지 않으므로 트리를 세울 수 없다.
  */
  it('취소 링크는 카드 밖이다 — 페이지는 Surface 를 그리지 않는다', () => {
    expect(page).toContain('href="/plans"')
    /* `toContain('<Surface')` 로는 못 쓴다 — 페이지가 쓰는 `<SurfaceStack` 이 걸린다 */
    expect(page).not.toMatch(/<Surface[\s/>]/)
  })
})

describe('보이는 제목은 카드가 그린다 (#453)', () => {
  /* 장소 목록(#439)과 같다 — 카드가 하나뿐이라 그 카드의 이름이 곧 페이지의 이름이다 */
  it('페이지의 h1 은 sr-only 다', () => {
    expect(page).toContain('<h1 className="sr-only">')
  })

  it('페이지에 보이는 제목 타이포가 남아 있지 않다', () => {
    expect(page).not.toContain('text-display')
  })

  it('뷰가 카드 제목으로 createTitle · createDescription 을 쓴다', () => {
    expect(view).toContain('title={messages.plan.createTitle}')
    expect(view).toContain('{messages.plan.createDescription}')
  })
})

describe('네 상태가 한 카드에 든다 (#453)', () => {
  /*
    **`lead` 가 `<Surface>` 의 prop 이라는 것까지 잠근다.** `toContain('lead')` 로 두면
    주석·변수명 어디에 있어도 통과해서, 제목이 `md:text-display` 를 잃어도 아무것도
    실패하지 않는다 — 이 화면의 카드 제목은 예전 페이지 `h1` 의 크기를 이어받은 것이다.
  */
  it('뷰가 Surface 를 import 하고 lead 카드를 그린다', () => {
    expect(view).toContain("import { Surface } from '@/components/surface'")
    expect(view).toMatch(/<Surface\s+lead\b/)
  })

  /*
    **상태에 따라 카드가 생겼다 사라지지 않는다** (#440). 네 갈래가 전부 같은 껍데기를
    거쳐야 하므로 `PlanCreateSurface` 의 사용처 수로 잠근다 — 하나를 빠뜨리면 그 상태에서
    화면의 흰 면이 통째로 없어진다.
  */
  it('조회 중 · 오류 · 0마리 · 폼 넷이 모두 같은 껍데기를 거친다', () => {
    expect(view.match(/<PlanCreateSurface>/g)).toHaveLength(4)
  })

  it('카드 안 상태 컴포넌트가 inset="card" 를 받는다', () => {
    expect(view).toMatch(/<ErrorState\s+inset="card"/)
    expect(view).toMatch(/<EmptyState\s+inset="card"/)
  })

  /* 폼도 카드 안이다 — 페이지 값 40 을 쓰면 내용이 두 번 밀린다 (§0) */
  it('폼 래퍼가 INSET_CLASS.card 를 쓴다', () => {
    expect(view).toContain('INSET_CLASS.card')
    expect(view).not.toContain('INSET_CLASS.main')
  })

  /*
    **조회 중 상태의 인셋은 빌린 것이다.** 이 화면은 `PlanListSkeleton` 을 그대로 쓰는데
    그 스켈레톤은 **일정 목록의 소유물**이라(#445), 저쪽 요구로 값이 `main`(40)으로 바뀌면
    이 카드 안에서 내용이 두 번 밀린다 — 그런데 그 화면의 테스트는 자기 목록만 보므로
    아무것도 실패하지 않는다. 빌린 쪽에서 잠근다.
  */
  it('조회 중 스켈레톤도 카드 인셋이다 — 일정 목록에서 빌려 쓴다', () => {
    const skeleton = code('src/features/plan/plan-list-skeleton.tsx')

    expect(view).toContain('<PlanListSkeleton rows={2} />')
    expect(skeleton).toContain('INSET_CLASS.card')
    expect(skeleton).not.toContain('INSET_CLASS.main')
  })
})
