import { expect, type Page, test as base } from '@playwright/test'

import { messages } from '@/lib/messages'
import type { ApiResponse } from '@/types/api'

/**
 * dev 스모크 공용 fixture — 이슈 #757.
 *
 * ### 쓰기를 막는다 (자동 fixture)
 *
 * **"쓰기 없이 검증한다" 를 스펙 작성자의 주의에 맡기지 않는다.** 공유 dev 의 실계정이라
 * 버튼 하나를 잘못 누르면 일정·반려견이 실제로 바뀐다. 그래서 dev 출처로 나가는
 * `GET`·`HEAD` 밖의 요청을 **네트워크에서 끊고** 기록해 두었다가 테스트 끝에 실패로
 * 올린다 — 앱이 화면을 여는 것만으로 쓰기를 부른다면 그것 자체가 알아야 할 사실이다.
 *
 * **페이지가 아니라 컨텍스트에 건다** — 링크가 새 탭으로 열려도 같은 가드를 지난다.
 * `page.request` 는 브라우저 네트워크를 타지 않아 여기 걸리지 않는다. 그래서 스펙은
 * `page.request` 로 **읽기(`readBff`)만** 한다. 로그인·로그아웃은 이 fixture 밖
 * (`login.setup.ts` · `logout.teardown.ts`)이다.
 *
 * ### 서버 5xx · 브라우저 런타임 오류를 모은다
 *
 * 이슈가 기준으로 삼은 dev 실측(2026-09-19)이 **"HTTP 200, 서버 5xx·브라우저 런타임 오류
 * 없음"** 이었다. 화면 단언은 그 화면이 기다린 것만 보므로, 옆에서 조용히 터진 BFF 5xx 나
 * `pageerror` 는 여기서 따로 잡는다.
 *
 * **URL 의 쿼리는 싣지 않는다** — 경로와 상태만 남긴다. 실패 메시지는 CI 로그에 그대로 찍힌다.
 */
export const test = base.extend<{ devGuard: void }>({
  devGuard: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL ?? '').origin
      const blockedWrites: string[] = []
      const serverErrors: string[] = []
      const pageErrors: string[] = []

      await page.context().route(
        (url) => url.origin === origin,
        async (route) => {
          const request = route.request()
          if (request.method() === 'GET' || request.method() === 'HEAD') {
            await route.fallback()
            return
          }
          blockedWrites.push(`${request.method()} ${new URL(request.url()).pathname}`)
          await route.abort('blockedbyclient')
        },
      )

      page.on('response', (response) => {
        const url = new URL(response.url())
        if (url.origin === origin && response.status() >= 500) {
          serverErrors.push(`${response.status()} ${url.pathname}`)
        }
      })
      page.on('pageerror', (error) => {
        pageErrors.push(error.message.split('\n')[0] ?? error.name)
      })

      await use()

      expect(blockedWrites, '읽기 전용 스모크에서 쓰기 요청이 나갔다').toEqual([])
      expect(serverErrors, 'dev 가 5xx 를 냈다').toEqual([])
      expect(pageErrors, '브라우저 런타임 오류가 났다').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/**
 * **BFF 를 거쳐 dev 게이트웨이를 실제로 읽는다.** 브라우저가 쓰는 길 그대로다
 * (`/api/bff` → 세션 쿠키 → 게이트웨이).
 *
 * 화면만 보면 부족하다 — SSR 프리페치는 실패를 삼키고(`.catch(() => undefined)`) 클라이언트가
 * 다시 부르므로, 목록이 비어 보이는 것이 "0건" 인지 "조회 실패" 인지 화면만으로는 가를 수
 * 없다. `dataHeader.success` 까지 본다 (`frontend/CLAUDE.md` 절대 규칙).
 *
 * **응답 본문을 메시지에 싣지 않는다.** 내 정보는 계정의 이메일·이름을 담는다.
 */
export async function readBff<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`/api/bff${path}`)
  const pathname = path.split('?')[0]

  expect(response.status(), `GET ${pathname} 상태`).toBe(200)
  const body = (await response.json()) as ApiResponse<T>
  expect(body.dataHeader.success, `GET ${pathname} dataHeader.success`).toBe(true)
  if (body.dataBody === null) throw new Error(`GET ${pathname} 가 dataBody 없이 성공했다`)

  return body.dataBody
}

/**
 * **화면이 로그인 세션으로 열리고 오류 상태로 떨어지지 않았는지.**
 *
 * - 문서 응답이 4xx·5xx 가 아니다.
 * - `/login` 으로 튕기지 않았다 — `proxy.ts` 는 세션 쿠키 **존재**만 보므로, 여기서 튕기면
 *   쿠키 자체가 빠진 것이다.
 * - 조회가 가라앉은 뒤 **그 화면의 오류 상태**가 없다.
 *
 * ### 오류 상태를 무엇으로 알아보나
 *
 * 여섯 화면 모두 `ErrorState`(`src/components/error-state.tsx`)로 오류를 그리는데, **제목은
 * 화면마다 다르다**(`messages.member.loadFailedTitle` · `messages.plan.errorTitle` …). 공용
 * 문구 하나로 찾으면 어느 화면에도 없는 글자를 찾아 늘 통과한다. 그래서 둘을 본다 — 호출부가
 * 넘기는 **그 화면의 오류 제목**과, `ErrorState` 가 기본으로 다는 **`다시 시도` 버튼**.
 *
 * ### 언제 보나 — 골격이 걷힌 뒤
 *
 * `networkidle` 을 기다리지 않는다. 쿼리 재시도의 backoff(1s · 2s …) 사이에 네트워크가 먼저
 * 가라앉아 오류가 그려지기 전에 풀릴 수 있고, 지도 SDK 처럼 요청이 이어지는 화면에서는 끝나지
 * 않는다. 대신 **로딩 골격(`Skeleton` 의 `animate-pulse`)이 걷히기를** 기다린다. 쿼리는 재시도가
 * 끝날 때까지 `pending` 이라 골격이 남으므로, 골격이 걷혔다면 성공·빈 상태·오류 중 하나가 섰다.
 */
export async function openScreen(page: Page, path: string, errorTitle: string): Promise<void> {
  const response = await page.goto(path)
  expect(response?.status() ?? 0, `${path} 문서 응답`).toBeLessThan(400)

  const pathname = path.split('?')[0] ?? path
  await expect(page).toHaveURL((url) => url.pathname === pathname)
  await expect(page.getByRole('main')).toBeVisible()

  const main = page.getByRole('main')
  await expect(main.locator('.animate-pulse'), `${path} 로딩 골격`).toHaveCount(0)
  await expect(main.getByText(errorTitle, { exact: true }), `${path} 오류 상태`).toHaveCount(0)
  await expect(
    main.getByRole('button', { name: messages.common.retry, exact: true }),
    `${path} 재시도 버튼`,
  ).toHaveCount(0)
}
