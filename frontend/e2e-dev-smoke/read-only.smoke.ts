import { DEFAULT_RADIUS_METERS, facilitiesPath } from '@/lib/api/emergency'
import { paths } from '@/lib/api/paths'
import { placeListPath } from '@/lib/api/place'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { SliceResponse } from '@/types/api'
import type { NearbyFacilityResult } from '@/types/emergency'
import type { PlaceSummary } from '@/types/place'

import { expect, openScreen, readBff, test } from './fixtures'

/**
 * **배포된 dev 의 읽기 전용 흐름** — 이슈 #757.
 *
 * 로그인 세션(`login.setup.ts`)으로 화면 여섯을 연다. 각 화면에서 두 가지를 본다.
 *
 * 1. **BFF 조회가 성공한다** — `readBff`. 게이트웨이·백엔드·세션 쿠키가 모두 선 것이다.
 * 2. **화면이 그 화면의 오류 상태 없이 열린다** — `openScreen`. SSR 과 `proxy.ts` 가 선 것이다.
 *
 * **데이터 양은 계정에 따라 다르다.** 일정·반려견·저장 목록은 0건이어도 정상이라 개수를
 * 단언하지 않는다. 장소·긴급시설은 공공 데이터라 계정과 무관하게 제주 도심에 반드시 있어
 * **1건 이상**을 본다 — 0건이면 적재나 조회 경로가 깨진 것이다.
 *
 * 쓰기는 `fixtures.ts` 의 자동 fixture 가 네트워크에서 끊는다.
 */
test.describe('dev 로그인 스모크 (#757)', () => {
  test('내 정보', async ({ page }) => {
    await readBff(page, paths.members.me)
    await openScreen(page, '/mypage', messages.member.loadFailedTitle)
  })

  test('장소 검색', async ({ page }) => {
    // 주소에 들어가는 말이라 공공 데이터가 적재돼 있는 한 비지 않는다
    const keyword = '제주'
    const slice = await readBff<SliceResponse<PlaceSummary>>(
      page,
      placeListPath({ ...DEFAULT_PLACE_FILTERS, keyword }, null),
    )
    expect(slice.contents.length, '장소 검색 결과 개수').toBeGreaterThan(0)

    await openScreen(
      page,
      `/places?view=list&keyword=${encodeURIComponent(keyword)}`,
      messages.place.errorTitle,
    )
    await expect(page.locator('#place-list').getByRole('listitem').first()).toBeVisible()
  })

  test.describe('긴급시설', () => {
    // 화면이 좌표를 브라우저에서 묻는다. 서버 기준점과 같은 곳(제주시청)을 준다
    test.use({
      geolocation: { latitude: JEJU_QUERY_CENTER.lat, longitude: JEJU_QUERY_CENTER.lng },
      permissions: ['geolocation'],
    })

    test('긴급시설 검색', async ({ page }) => {
      const result = await readBff<NearbyFacilityResult>(
        page,
        facilitiesPath({ ...JEJU_QUERY_CENTER, radius: DEFAULT_RADIUS_METERS, size: 10 }),
      )
      expect(result.facilities.length, '긴급시설 개수').toBeGreaterThan(0)

      /*
        **`openNowOnly=false` 로 연다.** 기본이 «지금 진료중» ON 이라(#654) 새벽에 돌면
        목록이 비는 것이 정상이다 — 스케줄 실행이 시각에 따라 빨갛게 되면 안 된다.
      */
      await openScreen(page, '/emergency?openNowOnly=false', messages.emergency.errorTitle)
      await expect(page.locator('#emergency-list').getByRole('listitem').first()).toBeVisible()
    })
  })

  test('여행 일정 목록', async ({ page }) => {
    await readBff(page, `${paths.plans.list}?size=1`)
    await openScreen(page, '/plans', messages.plan.errorTitle)
  })

  test('반려견 목록', async ({ page }) => {
    await readBff(page, paths.members.pets)
    await openScreen(page, '/pets', messages.pet.loadFailedTitle)
  })

  test('저장한 장소 목록', async ({ page }) => {
    await readBff(page, paths.favorites.places)
    await openScreen(page, '/favorites', messages.favorite.loadFailedTitle)
  })
})
