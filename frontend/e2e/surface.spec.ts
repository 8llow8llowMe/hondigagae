import { expect, test } from '@playwright/test'

import {
  hasHorizontalOverflow,
  headingOutline,
  leftEdge,
  surfaceStyle,
  token,
  VIEWPORTS,
} from './helpers/layout'

/**
 * **3층 표면(`DESIGN.md §0`) 불변식.** 로드맵 #455 가 화면을 하나씩 옮기는 동안 손으로
 * 재던 값들을 코드로 잠근다 (이슈 #467).
 *
 * 화면별 디자인이 아니라 **층 규약**만 본다 — 바닥은 `--bg-sunken`, 카드는 흰 면에
 * 그림자 없이 radius 12(모바일은 전폭·상하 테두리만), L0 위 블록은 카드 안 글줄과 같은
 * 세로선. 화면 고유의 배치는 각 화면 렌더 테스트(vitest)와 `fe-design-reviewer` 의 몫이다.
 */
/**
 * **`/places` 는 `?view=list` 로 연다.** 기본값이 지도(`PLACES_DEFAULT_VIEW`)인데
 * **지도는 전폭 미디어라 카드가 아니다** — §0 판정에서 명시적으로 빠지는 예외다.
 * 기본 URL 을 그대로 쓰면 이 스펙이 "L0 바닥이 없다" 로 지도 갈래를 오진한다.
 */
/**
 * **`/ai-plans/new` 은 폼 화면 쪽 대표다** (#473). 목록 넷과 달리 카드 하나가 로딩·오류·
 * 0마리·폼을 전부 담으므로, "상태가 바뀌어도 카드가 생겼다 사라지지 않는다" 를 실제
 * 렌더에서 받쳐 준다. **작업 상태(`/ai-plans/jobs/[jobId]`)는 넣지 않는다** — 살아 있는
 * `jobId` 가 있어야 열리는 화면이고, 없는 id 로 열면 404 갈래만 재게 된다.
 */
/**
 * **`/plans` 를 넣는 이유는 `rail-layout` 이다** (#520). `Canvas` 가 `margin-inline: auto` 를
 * 가진 클래스를 **직접** 다는 라우트가 `/places` 와 `/plans` 둘인데, 회귀가 가장 크게 난
 * 쪽이 `/plans` 였다 (390 에서 바닥 240). 한쪽만 재면 다른 쪽 드리프트를 못 잡는다.
 */
const SCREENS = [
  '/mypage',
  '/pets',
  '/favorites',
  '/places?view=list',
  '/plans',
  '/ai-plans/new',
] as const

test.describe('3층 표면', () => {
  for (const path of SCREENS) {
    test.describe(path, () => {
      test('바닥은 --bg-sunken 이고 전폭이다', async ({ page }) => {
        await page.goto(path)
        const main = page.getByRole('main')

        const [bg, sunken] = await Promise.all([
          main.evaluate((el) => getComputedStyle(el).backgroundColor),
          token(page, '--bg-sunken'),
        ])

        // 토큰 문자열과 계산된 rgb 를 직접 비교할 수 없다 — 같은 값을 다시 칠해 비교한다
        const sunkenRgb = await page.evaluate((value) => {
          const probe = document.createElement('div')
          probe.style.backgroundColor = value
          document.body.append(probe)
          const computed = getComputedStyle(probe).backgroundColor
          probe.remove()
          return computed
        }, sunken)

        expect(bg).toBe(sunkenRgb)
      })

      /*
        **이름값을 하게 만든다** (#520). 위 단언은 `전폭이다` 라고 적혀 있으면서 **배경색만**
        봤다 — 그래서 #484 가 `(main)` 을 flex 열로 바꿨을 때 `rail-layout` 을 직접 다는
        라우트의 바닥이 내용 폭으로 쪼그라든 것을 아무것도 잡지 못했다
        (1920 `/places` 707 · 390 `/plans` 240).

        **flex 아이템은 cross 축 margin 이 `auto` 면 `stretch` 가 무효가 된다** — 그 클래스를
        `Canvas` 에 직접 다는 화면이 있으므로 폭은 실제로 재야 한다. `Canvas` 쪽 유닛 단언은
        `w-full` 이 붙어 있는지만 알고, 그것이 실제로 전폭을 만드는지는 모른다.

        **1440 캡도 함께 본다** — `w-full` 이 `max-inline-size` 를 덮어 캡을 깨면 그것도 버그다.
      */
      for (const [name, size] of Object.entries(VIEWPORTS)) {
        test(`${name} 에서 바닥이 전폭이다`, async ({ page }) => {
          await page.setViewportSize(size)
          await page.goto(path)
          await expect(page.getByRole('main')).toBeVisible()

          const floor = await page.evaluate(() => {
            const main = document.querySelector('main') as HTMLElement
            const box = main.getBoundingClientRect()
            const cap = getComputedStyle(main).maxInlineSize
            return {
              width: Math.round(box.width),
              left: Math.round(box.left),
              viewport: window.innerWidth,
              cap: cap === 'none' ? null : Math.round(Number.parseFloat(cap)),
            }
          })

          const cap = floor.cap ?? Number.POSITIVE_INFINITY
          const expected = Math.min(floor.viewport, cap)

          expect(floor.width).toBe(expected)
          /*
            캡보다 좁은 뷰포트면 왼쪽 끝(0), 넓으면 `margin-inline: auto` 가 가운데로 보낸다.
            **둘을 함께 본다** — 폭만 보면 `w-full` 이 캡을 덮어 전폭이 돼도 통과한다.
          */
          expect(floor.left).toBe(Math.round((floor.viewport - expected) / 2))
        })
      }

      test('카드는 흰 면 + 그림자 없음이고, radius 는 md 에서만 붙는다', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile)
        await page.goto(path)

        const card = page.getByRole('main').locator('section').first()
        const mobile = await surfaceStyle(card)

        // 모바일(<768)은 전폭이다 — radius 와 좌우 테두리를 걷고 상하만 남긴다 (§0)
        expect(mobile.boxShadow).toBe('none')
        expect(mobile.borderTopLeftRadius).toBe('0px')
        expect(mobile.borderLeftWidth).toBe('0px')
        expect(mobile.borderTopWidth).toBe('1px')

        await page.setViewportSize(VIEWPORTS.desktop)
        const desktop = await surfaceStyle(card)

        expect(desktop.boxShadow).toBe('none')
        // radius 12 이지 16 이 아니다 — 16 은 오버레이 몫이다 (§0)
        expect(desktop.borderTopLeftRadius).toBe('12px')
        expect(desktop.borderLeftWidth).toBe('1px')
        expect(desktop.backgroundColor).toBe(mobile.backgroundColor)
      })

      for (const [name, size] of Object.entries(VIEWPORTS)) {
        test(`${name} 에서 가로로 넘치지 않는다`, async ({ page }) => {
          await page.setViewportSize(size)
          await page.goto(path)

          expect(await hasHorizontalOverflow(page)).toBe(false)
        })
      }

      /**
       * **`h1` 은 하나, 내려갈 때는 한 단씩.** 3a 가 목록 항목을 `h3` 로 내린(#464 · #466)
       * 축이 유지되는지 본다 — 카드가 `h2` 인데 항목이 `h2` 면 구조가 평평해진다.
       *
       * **"첫 제목이 `h1`" 은 요구하지 않는다.** `/places?view=list` 는 필터 레일이
       * `main` 안에서 목록보다 앞에 있어 `h2 필터` 가 페이지 `h1` 보다 먼저 나온다
       * (#439 의 레일 레이아웃). 제목으로 탐색할 때 걸리는 순서지만 이 스펙이 정할
       * 문제가 아니라, 여기서는 실제로 성립하는 불변식만 잠근다.
       */
      test('h1 이 하나이고 제목 레벨이 한 단씩만 내려간다', async ({ page }) => {
        await page.goto(path)
        // 카드가 서기 전에 재면 Suspense 전환 중의 두 트리를 함께 본다
        await expect(page.getByRole('main').locator('section').first()).toBeVisible()

        const outline = await headingOutline(page)

        expect(outline.filter((entry) => entry.startsWith('H1:'))).toHaveLength(1)

        let previous = Number(outline[0]?.[1] ?? 1)
        for (const entry of outline) {
          const level = Number(entry[1])
          // 내려갈 때 한 단씩만 — 올라가는 것(h3 → h2)은 다음 묶음이라 제한하지 않는다
          expect(level).toBeLessThanOrEqual(previous + 1)
          previous = level
        }
      })
    })
  }
})

/**
 * **제목 있는 카드 안의 상태는 `h3` 다** (#456① · #469).
 *
 * 위 `h1 이 하나이고 …` 는 **레벨을 건너뛰는 것**만 본다 — `h2` 다음에 또 `h2` 가 오는
 * 것은 건너뛰기가 아니라 통과한다. 정작 이 이슈의 증상이 그 형제 `h2` 둘이었다:
 * 카드 제목과 상태 제목이 같은 레벨이라 **카드 내용의 제목이 카드 자신의 제목처럼**
 * 읽혔다. 그래서 자리를 콕 집어 따로 잠근다.
 *
 * **소스 단언(`state-heading-level.test.ts`)이 못 보는 것을 여기서 본다.** 그쪽은
 * `headingLevel={3}` 이 호출처에 적혀 있는지만 알고, 그 값이 실제로 `h3` 태그가 되어
 * 카드 `h2` 아래 붙는지는 모른다 — 컴포넌트가 prop 을 무시해도 통과한다.
 *
 * **0건을 `keyword` 로 만든다.** 목이 제목·주소를 훑어 거르므로(`mock/index.ts`)
 * 실재하지 않는 낱말이면 빈 상태가 확실히 선다. 목록에 의존하지 않아 fixture 가 바뀌어도
 * 흔들리지 않는다.
 */
test.describe('카드 안 상태 제목 — #456①', () => {
  test('/places 빈 결과에서 카드 h2 아래 상태가 h3 로 선다', async ({ page }) => {
    await page.goto('/places?view=list&keyword=존재하지않는장소이름ZZZ')

    const card = page.getByRole('main').locator('section').first()
    await expect(card).toBeVisible()

    // 카드 자신의 제목은 h2 다
    await expect(card.getByRole('heading', { level: 2 })).toHaveCount(1)

    /*
      상태 제목은 그 아래 h3 다. 이름으로 집지 않는다 — 서버 문구(`resultMessage`)가
      오면 그대로 노출하는 자리라(`styling-guide.md` §7) 문자열이 고정이 아니다.
    */
    const stateHeading = card.getByRole('heading', { level: 3 })
    await expect(stateHeading).toHaveCount(1)
    await expect(stateHeading).toBeVisible()

    /*
      **형제 `h2` 가 둘이 되는 것이 이 이슈의 증상이었다.** 카드 안 `h2` 하나는 위에서
      이미 봤으니, 여기서는 **페이지 전체**로 넓혀 본다 — 카드 밖 어딘가가 같은 자리에
      `h2` 를 하나 더 그려도 잡히게. `/places` 는 필터 레일이 `h2` 를 갖는 화면이라
      개수가 아니라 **카드 안쪽 것이 하나뿐인지**가 기준이다.
    */
    const outline = await headingOutline(page)
    expect(outline.filter((entry) => entry.startsWith('H1:'))).toHaveLength(1)
    expect(await card.getByRole('heading', { level: 2 }).count()).toBe(1)
  })
})

/**
 * **L0 위 블록은 카드 안 글줄과 같은 세로선에 선다** (`plan-add-place-header`, #451).
 *
 * `md` 이상에서 카드 테두리 1px 만큼 남는 어긋남은 의도된 것이다 — `Surface` 가
 * `md:border` 를 써서 padding box 가 border box 보다 1px 안쪽인데, L0 블록에는 상쇄할
 * 테두리가 없다. 모바일(`border-y`)은 정확히 맞는다. **그 1px 이 20px 로 벌어지는 것을
 * 잡는 것이 이 테스트의 목적이다** (인셋을 `card` 가 아니라 `main` 으로 주면 그렇게 된다).
 */
test.describe('L0 위 블록의 세로 기준선 — /mypage', () => {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    test(`${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.goto('/mypage')

      const cardText = page.getByRole('heading', { name: '계정', exact: true })
      const l0Action = page.getByRole('button', { name: '로그아웃', exact: true })

      await expect(cardText).toBeVisible()
      await expect(l0Action).toBeVisible()

      const drift = (await leftEdge(cardText)) - (await leftEdge(l0Action))

      expect(drift).toBeLessThanOrEqual(size.width < 768 ? 0 : 1)
      expect(drift).toBeGreaterThanOrEqual(0)
    })
  }
})

/**
 * **예외 화면도 3층 표면 위에 선다** (#475 — 로드맵 #455 의 12번).
 *
 * #467 이 이 스펙을 미뤄 둔 이유가 *"이 파일들이 아직 2a 라 12번에서 옮긴 뒤에 쓰는 것이
 * 맞다"* 였고, 이 이슈가 그 전제를 해소했다.
 *
 * **`not-found` 만 넣는다.** 없는 id 로 라우팅하면 실제로 띄울 수 있다 — `page.tsx` 가
 * 404 를 받아 `notFound()` 를 던진다. **`error.tsx` 는 넣지 않았다**: 띄우려면 렌더
 * 중에 실제로 예외가 나야 하는데, 목 저장소는 형식이 맞는 응답만 돌려주고 실패를 주입할
 * 경로가 없다. 억지로 만들면(빌드 타임 플래그·주입 라우트) 프로덕션에 없는 경로가 생겨
 * **검증 대상이 아닌 것을 검증하게 된다.** 같은 계약은 `route-state-surface.test.ts` 가
 * 소스 문자열로 잠근다 — 두 파일은 표면 코드가 한 글자도 다르지 않다.
 *
 * **로그인 상태 둘을 함께 고른다** — `/places` 는 공개, `/plans` 는 보호 경로다.
 */
/**
 * **제목을 `level: 2` 로 집는다.** `h1` 은 `sr-only` 이고 상태 컴포넌트의 `h2` 와 같은
 * 말을 쓴다 — 보이는 제목을 `h2` 가 이미 그리기 때문이다 (#453 · #473 이 받아들인 거래).
 * 레벨을 안 주면 strict mode 가 둘을 다 잡아 실패한다.
 */
const NOT_FOUND_SCREENS = [
  { path: '/places/99999999', title: '장소를 찾을 수 없어요' },
  { path: '/plans/99999999', title: '찾을 수 없는 일정이에요' },
] as const

test.describe('3층 표면 — not-found', () => {
  for (const { path, title } of NOT_FOUND_SCREENS) {
    test.describe(path, () => {
      test('바닥은 --bg-sunken 이고 전폭이다', async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()

        const main = page.getByRole('main')

        const [bg, sunken] = await Promise.all([
          main.evaluate((el) => getComputedStyle(el).backgroundColor),
          token(page, '--bg-sunken'),
        ])

        const sunkenRgb = await page.evaluate((value) => {
          const probe = document.createElement('div')
          probe.style.backgroundColor = value
          document.body.append(probe)
          const computed = getComputedStyle(probe).backgroundColor
          probe.remove()
          return computed
        }, sunken)

        expect(bg).toBe(sunkenRgb)
      })

      /*
        **이 둘은 카드가 아니다** — 카드 판정은 그 세그먼트의 정상 화면을 따르는데
        (`route-state-surface.test.ts` 머리주석), `PlaceDetailSection` ·
        `PlanDetailView` 는 404 · 400 · 5xx 를 **카드 없이 L0 위에 바로** 그린다.
        여기서 `/places` · `/plans` 를 고른 것이 바로 그 갈래라 `section` 이 0개다.
        카드를 그리는 여덟(반려견·저장한 곳·마이페이지·장소 목록·AI 둘)은 소스 단언
        쪽에서 본다 — 그쪽은 예외를 실제로 띄울 경로가 없다.
      */
      test('카드를 그리지 않는다 — 상태가 L0 바닥 위에 직접 선다', async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()

        await expect(page.getByRole('main').locator('section')).toHaveCount(0)
      })

      /*
        **404 에 재시도 버튼을 달지 않는다** (`frontend/CLAUDE.md` 절대 규칙). 소스
        단언은 `ErrorState` 를 쓰지 않는다는 것까지만 보고, 실제로 버튼이 한 개도 그려지지
        않는지는 여기서 본다.
      */
      test('재시도 버튼이 없다 — 404 는 데이터 부재다', async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()

        await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0)
      })

      test('h1 이 하나이고 제목 레벨이 한 단씩만 내려간다', async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()

        const outline = await headingOutline(page)

        expect(outline.filter((entry) => entry.startsWith('H1:'))).toHaveLength(1)

        let previous = Number(outline[0]?.[1] ?? 1)
        for (const entry of outline) {
          const level = Number(entry[1])
          expect(level).toBeLessThanOrEqual(previous + 1)
          previous = level
        }
      })

      for (const [name, size] of Object.entries(VIEWPORTS)) {
        /*
          **글줄이 카드 안 글줄과 같은 축에 선다** — `SurfaceStack` 왼쪽에서 16(모바일) /
          20(md 이상, 스택의 `md:p-6` 24 를 뺀 값)이다. 인셋을 `card` 가 아니라 `main`
          으로 주면 md 이상에서 40 이 되어 20px 벌어진다 — 그것을 잡는 것이 목적이다.
        */
        test(`${name} 에서 인셋이 카드 축(16/20)이다`, async ({ page }) => {
          await page.setViewportSize(size)
          await page.goto(path)

          const heading = page.getByRole('heading', { name: title, level: 2 })
          await expect(heading).toBeVisible()

          const stack = page.getByRole('main').locator('> div').first()
          const drift = (await leftEdge(heading)) - (await leftEdge(stack))

          expect(drift).toBe(size.width < 768 ? 16 : 44)
        })

        test(`${name} 에서 가로로 넘치지 않는다`, async ({ page }) => {
          await page.setViewportSize(size)
          await page.goto(path)
          await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()

          expect(await hasHorizontalOverflow(page)).toBe(false)
        })

        /*
          **바닥이 뷰포트에서 끊기지 않는다** (#456③).

          상태 화면은 내용이 짧아 이 드리프트가 가장 잘 드러나는 자리다 — 고치기 전
          1280×900 실측에서 회색이 274 에서 끝나고 푸터 아래 **366px 가 맨 흰색**이었다.
          `DESIGN.md §0` 의 "흰색은 바닥이 아니라 섹션의 색" 이 거기서 뒤집힌다.

          **소스 단언(`main-layout-surface.test.ts`)이 못 보는 것을 여기서 본다.** 그쪽은
          클래스 문자열이 제자리에 있는지만 알고, 그 조합이 실제로 높이를 만들어 내는지는
          모른다 — `flex-1` 을 받을 부모가 `flex` 를 잃는 식의 회귀는 브라우저에서만 잡힌다.

          **푸터 바닥까지 함께 본다.** 회색만 보면 `min-h` 로 고친 안(기각)도 통과하는데,
          그 안은 없던 스크롤을 짧은 화면마다 만든다. 문서 높이 = 뷰포트 높이를 같이
          단언해야 그 갈래가 갈린다.
        */
        test(`${name} 에서 바닥이 뷰포트 끝까지 이어진다 — 스크롤은 생기지 않는다`, async ({
          page,
        }) => {
          await page.setViewportSize(size)
          await page.goto(path)
          await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()

          const geometry = await page.evaluate(() => {
            const round = (value: number) => Math.round(value)
            const footer = document.querySelector('.site-footer')?.getBoundingClientRect()
            const canvas = document.querySelector('main')?.getBoundingClientRect()
            return {
              viewport: window.innerHeight,
              doc: document.documentElement.scrollHeight,
              canvasBottom: round(canvas?.bottom ?? -1),
              footerTop: round(footer?.top ?? -1),
              footerBottom: round(footer?.bottom ?? -1),
            }
          })

          // 회색이 푸터 바로 위까지 온다 — 둘 사이에 흰 띠가 없다
          expect(geometry.canvasBottom).toBe(geometry.footerTop)
          // 푸터가 뷰포트 바닥에 앉는다. 내려가면 없던 스크롤이 생긴 것이다
          expect(geometry.footerBottom).toBe(geometry.viewport)
          expect(geometry.doc).toBe(geometry.viewport)
        })
      }
    })
  }
})

/**
 * **카드 안 상태의 좌우 인셋 — #485.**
 *
 * `EmptyState` · `ErrorState` 의 `inset` 기본값은 `main`(16/40)이고 카드 안 글줄은
 * `card`(16/20)다. 카드 안에서 `inset` 을 안 주면 상태 글줄만 형제보다 **데스크톱에서
 * 20px 오른쪽**으로 밀린다. 모바일(16)은 같아서 `md` 이상에서만 갈린다 — **그래서 눈으로
 * 보다가 놓치기 쉽고, vitest 는 클래스 문자열만 봐서 실제 세로선을 못 본다.**
 *
 * `state-inset.test.ts` 가 "호출처에 `inset` 이 적혀 있는가" 를 잠그고, 여기서는 그 값이
 * **실제로 같은 세로선을 만드는가**를 잰다. 두 축이 따로 필요한 이유는 값이 `card` 여도
 * 담는 쪽이 이미 인셋을 줬으면 결과가 어긋날 수 있어서다.
 */
/**
 * **모바일 필터 칩도 카드 글줄과 같은 축이다** — 이슈 #457.
 *
 * 칩은 카드 **밖** 도구다(#439) — 목록을 좁히는 도구이고 카드는 그 결과를 담는다.
 * 그래도 L0 위에 놓이는 블록은 **카드 안 글줄과 같은 축**이어야 한다
 * (`plan-add-place-header` 의 `inset` 주석, #451).
 *
 * 예전에는 칩이 `md:px-10` 을 직접 적어, `SurfaceStack` 의 `md:p-6`(24) 위에 40 이 얹혀
 * 768 에서 글줄이 64 에 섰다 — 카드 제목(24+1+20 = 45)과 19px 갈렸다.
 *
 * **`toBe` 가 아니라 1px 허용이다.** 카드 테두리 1px 만큼 남는 차이는 #443 · #447 과 같은
 * 의도이고, 모바일은 카드가 전폭이라 테두리가 좌우에 없어 정확히 같아진다 — 두 값이 다른
 * 것이 맞으므로 뷰포트마다 기대값을 따로 두지 않고 **"1px 이내" 하나로 본다.**
 */
test.describe('모바일 필터 칩의 세로선 — #457', () => {
  const CHIP_SCREENS = [
    { path: '/places?view=list', label: '장소 찾기' },
    { path: '/plans', label: '일정' },
  ] as const

  for (const { path, label } of CHIP_SCREENS) {
    for (const name of ['mobile', 'tablet'] as const) {
      test(`${label} ${name} — 칩 글줄이 카드 제목과 1px 안에 선다`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[name])
        await page.goto(path)

        const main = page.getByRole('main')
        const card = main
          .locator('section')
          .filter({ has: page.locator('h2') })
          .first()
        await expect(card).toBeVisible()

        /* 칩 스트립 = 카드보다 앞에 오는 `border-b` 블록 중 좌우 padding 을 가진 것 */
        const chipLeft = await page.evaluate(() => {
          const root = document.querySelector('main') as HTMLElement
          const target = root.querySelector('section') as HTMLElement
          const strip = [...root.querySelectorAll('div')].find(
            (d) =>
              getComputedStyle(d).borderBottomWidth !== '0px' &&
              getComputedStyle(d).paddingLeft !== '0px' &&
              (d.compareDocumentPosition(target) & 4) !== 0,
          )
          const first = strip?.querySelector('button, a, span')
          return first === undefined || first === null
            ? null
            : Math.round(first.getBoundingClientRect().left)
        })

        expect(chipLeft).not.toBeNull()
        const titleLeft = await leftEdge(card.getByRole('heading', { level: 2 }).first())

        expect(Math.abs((chipLeft as number) - titleLeft)).toBeLessThanOrEqual(1)
      })
    }
  }
})

test.describe('카드 안 상태의 세로선 — #485', () => {
  test('/plans 필터 0건에서 상태 글줄이 카드 제목과 같은 세로선에 선다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)

    /*
      **없는 반려견으로 걸러 0건을 만든다.** 목 저장소에 일정이 넷 있어 필터 없이는 빈
      상태가 나지 않는다. `petId` 는 URL 이 소유하는 필터다 (`lib/url/plan-filters.ts`).
    */
    await page.goto('/plans?petId=000000000000000000')

    const card = page
      .getByRole('main')
      .locator('section')
      .filter({ has: page.locator('h2') })
      .first()
    await expect(card).toBeVisible()

    const cardHeading = card.getByRole('heading', { level: 2 }).first()
    const stateHeading = card.getByRole('heading', { level: 3 }).first()
    await expect(stateHeading).toBeVisible()

    /*
      **카드 제목이 기준선이다.** 카드 자신의 인셋(20)으로 서 있으므로, 상태가 기본값
      (`main`, 40)으로 흘러가면 여기서 20px 차이로 잡힌다.
    */
    expect(await leftEdge(stateHeading)).toBe(await leftEdge(cardHeading))
  })

  /*
    **모바일에서는 원래 같았다** — 둘 다 16 이라 어긋남이 안 보인다. 그 사실을 함께
    잠그지 않으면, 나중에 `card` 의 모바일 값이 움직여도 데스크톱 단언만으로는 안 걸린다.
  */
  test('모바일에서도 같은 세로선이다 — 원래 어긋나지 않던 쪽', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto('/plans?petId=000000000000000000')

    const card = page
      .getByRole('main')
      .locator('section')
      .filter({ has: page.locator('h2') })
      .first()
    const cardHeading = card.getByRole('heading', { level: 2 }).first()
    const stateHeading = card.getByRole('heading', { level: 3 }).first()
    await expect(stateHeading).toBeVisible()

    expect(await leftEdge(stateHeading)).toBe(await leftEdge(cardHeading))
  })
})

/**
 * **잘못된 `placeId` 에서 요청이 나가지 않는다 — #496.**
 *
 * `/places/abc` 는 상세·적합도·산책 안전 **세 요청이 모두 나가 400 이 3건** 났다. 백엔드
 * 상세 컨트롤러가 `@PathVariable long` 이라 숫자가 아니면 답이 400 으로 정해져 있는데도
 * 물어본 것이다. 적합도·산책 안전은 **반려견 조건까지 쿼리에 실어** 보내므로, 실패가
 * 확정된 요청에 개인 조건이 실려 나가기도 했다.
 *
 * **vitest 로는 확인할 수 없는 갈래다** — 지키려는 것이 마크업이 아니라 **나간 요청의
 * 개수**다. 화면은 고치기 전에도 올바른 오류를 그렸으므로 렌더 단언으로는 회귀를 못 잡는다.
 */
test.describe('잘못된 placeId — 요청을 보내지 않는다 (#496)', () => {
  const BAD = '/places/abc'
  /** 목 저장소의 첫 장소 (`place-data.ts` 의 `ID_BASE`). 18자리 Snowflake 다 */
  const FIRST_MOCK_PLACE_ID = '212481712381923329'

  test('BFF 로 나가는 요청이 0건이다', async ({ page }) => {
    const calls: string[] = []
    page.on('request', (request) => {
      const { pathname } = new URL(request.url())
      if (pathname.startsWith('/api/bff/')) calls.push(pathname)
    })

    await page.goto(BAD)
    await expect(page.getByRole('main')).toBeVisible()
    // 클라이언트 훅이 늦게 켜질 여지를 준다 — 마운트 직후 0건인 것만으로는 부족하다
    await page.waitForTimeout(1000)

    expect(calls).toEqual([])
  })

  /*
    **문구를 바꾸는 이슈가 아니다.** 요청만 없애고 화면은 그대로여야 한다 — 서버가 400 을
    답해 화면 안에서 잡았을 때와 **같은 말을 해야** 하고(#480 의 축), 주소가 잘못된 것이라
    재시도 버튼을 붙이지 않는다.
  */
  test('오류 화면은 그대로다 — 재시도 버튼은 없다', async ({ page }) => {
    await page.goto(BAD)

    const main = page.getByRole('main')
    await expect(main).toContainText('요청 조건이 올바르지 않아요')
    await expect(main).toContainText('주소가 잘못되었거나 삭제된 장소예요')
    await expect(main.getByRole('link', { name: '장소 목록으로' })).toBeVisible()
    await expect(main.getByRole('button', { name: '다시 시도' })).toHaveCount(0)
  })

  test('콘솔에 오류가 찍히지 않는다 — 400 셋이 진짜 오류를 덮었다', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })

    await page.goto(BAD)
    await expect(page.getByRole('main')).toBeVisible()
    await page.waitForTimeout(1000)

    expect(errors).toEqual([])
  })

  /*
    **가드가 정상 주소까지 막으면 화면이 통째로 빈다.** 목 저장소의 첫 장소 id 를 쓴다
    (`place-data.ts` 의 `ID_BASE`) — Snowflake 18자리라 **`Number()` 로 바꾸면 정밀도를
    잃는 길이**이기도 하다. 판정을 문자열 패턴으로 둔 이유가 여기서 함께 지켜진다.

    상세는 서버가 프리페치해 브라우저 요청이 없을 수 있으므로, **적합도·산책 안전이
    실제로 나가는지**를 본다 — 둘은 클라이언트 전용이라 가드가 잘못 걸리면 사라진다.
  */
  test('올바른 id 는 판정 조회가 그대로 나간다', async ({ page }) => {
    const calls: string[] = []
    page.on('request', (request) => {
      const { pathname } = new URL(request.url())
      if (/^\/api\/bff\/places\/\d+\/(suitability|walk-safety)$/.test(pathname)) {
        calls.push(pathname)
      }
    })

    await page.goto(`/places/${FIRST_MOCK_PLACE_ID}`)
    await expect(page.getByRole('main')).toBeVisible()
    await page.waitForTimeout(1000)

    expect(calls.length).toBeGreaterThan(0)
  })
})
