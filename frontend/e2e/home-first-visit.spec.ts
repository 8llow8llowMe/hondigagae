import { expect, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { VIEWPORTS } from './helpers/layout'

/**
 * **첫 방문자의 첫 화면에 판정이 선다** (이슈 #636 · `홈-첫방문-판정-세부명세.md` D7).
 *
 * vitest 로는 못 재는 것이 둘이라 여기 둔다.
 *
 * 1. **스토리지가 빈 컨텍스트.** 이 회귀는 `localStorage` 가 비어 있을 때만 난다 —
 *    개발 브라우저에는 `hdg_recent_place` 가 이미 들어 있어 손으로는 재현되지 않는다.
 *    심사용 브라우저 · 시크릿 모드 · 새 기기가 전부 이 상태다.
 * 2. **접힘 상태의 실제 가시성.** 모바일 판정은 기본이 접힘이고, `renderToStaticMarkup`
 *    문자열 단언은 `hidden` 클래스가 붙은 줄도 "있다" 고 답한다.
 *
 * **스크롤하지 않는다.** 이 이슈의 주장은 "첫 문장이 **첫 화면에** 있다" 이므로,
 * `scrollY === 0` 을 함께 못박는다 — 뷰포트 밖으로 밀려나면 고친 것이 아니다.
 */
test.describe('홈 첫 방문 — 대표 지점 판정 (390)', () => {
  // 미로그인 · 스토리지 없음. `storageState` 는 쿠키와 origin 저장소를 함께 비운다
  test.use({ storageState: { cookies: [], origins: [] }, viewport: VIEWPORTS.mobile })

  test('첫 화면에 오늘 산책 등급과 대표 지점 캡션이 보인다', async ({ page }) => {
    await page.goto('/')

    const main = page.getByRole('main')
    /*
      **`exact` 다.** 바로 아래 골든타임 섹션의 이름이 `오늘 산책하기 좋은 시간` 이라
      부분 일치로 두면 둘이 잡힌다 — 두 섹션이 "지금 나가도 되나 → 그럼 언제" 로 이어져
      이름이 겹치는 것은 의도된 것이다.
    */
    const verdict = main.getByRole('region', { name: messages.home.walkTodayLabel, exact: true })

    /*
      등급어는 서버 `walkSafetyLevel.name` 이라 FE 가 값을 알지 못한다 — **매핑 테이블을
      만들지 않는다**(`frontend/CLAUDE.md`). 그래서 특정 낱말이 아니라 라벨 옆에 비어 있지
      않은 등급어가 섰는지를 본다.
    */
    await expect(verdict).toBeVisible()
    await expect(verdict.getByText(messages.home.walkTodayLabel).first()).toBeVisible()
    await expect(verdict.getByText(messages.home.basisDefaultNote).first()).toBeVisible()

    // 접힌 줄에서 라벨 바로 뒤에 낱말이 하나 더 선다 — 그것이 등급어다
    expect(await verdict.innerText()).toMatch(new RegExp(`${messages.home.walkTodayLabel}\\s+\\S+`))

    // 스크롤 없이 보였다 — 판정이 첫 화면 밖으로 밀리지 않았다
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  /*
    **온보딩 행** (D1 · H-4). 미로그인 첫 화면에서 서비스가 시키는 유일한 일이라
    주 버튼으로 서 있어야 한다.
  */
  test('첫 화면에 반려견 등록 주 버튼이 보인다', async ({ page }) => {
    await page.goto('/')

    const register = page.getByRole('main').getByRole('link', { name: messages.home.registerPet })

    await expect(register).toBeVisible()
    await expect(register).toHaveAttribute('href', '/pets/new')
  })
})
