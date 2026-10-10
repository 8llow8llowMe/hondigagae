import type { Page } from '@playwright/test'

/**
 * **위치 권한을 거부한 브라우저로 만든다** — 이슈 #639.
 *
 * `context.grantPermissions` 의 반대 동작(권한을 주지 않는 것)에 기대지 않는다.
 * 권한이 없는 헤드리스 Chromium 은 `getCurrentPosition` 을 **거부로 끝낼 수도, 아무
 * 콜백도 부르지 않을 수도** 있다 — 후자면 우리 쪽 11초 타임아웃 가드
 * (`lib/geo/current-position.ts`)가 풀릴 때까지 화면이 골격에 머물러 스펙이 느려지고,
 * 무엇보다 **어느 갈래를 재고 있는지가 실행마다 달라진다**(`denied` 인가 `timeout` 인가).
 *
 * 그래서 콜백을 우리가 직접 부른다. `code: 1` 은 `PERMISSION_DENIED` 이고
 * `toFailure()` 가 그것만 `denied` 로 좁힌다.
 */
export async function denyGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const denied = { code: 1, message: 'User denied Geolocation' }

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: unknown, error?: (reason: unknown) => void) => {
          error?.(denied)
        },
        watchPosition: () => 0,
        clearWatch: () => undefined,
      },
    })
  })
}
