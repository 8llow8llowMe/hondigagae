import { expect, test as setup } from '@playwright/test'

/**
 * 로그인 한 번으로 `storageState` 를 만든다. 보호 라우트(`/mypage` · `/pets` ·
 * `/favorites` · `/plans` · `/ai-plans`)는 `proxy.ts` 가 세션 쿠키 **존재**를 보고
 * 307 로 `/login` 에 보내므로, 이것 없이는 실화면을 한 장도 볼 수 없다.
 *
 * **쿠키를 위조하지 않는다.** `seal()` 로 직접 구워 넣을 수도 있지만, 그러면 로그인
 * 경로 자체가 검증되지 않고 세션 형식이 바뀔 때 이 파일만 조용히 낡는다. 실제 폼으로
 * 들어가면 이 setup 이 로그인 스모크 테스트를 겸한다.
 *
 * 계정은 `MOCK_API=true` 저장소의 일반 계정이다 (`src/lib/api/mock/store.ts`) —
 * provider 없음 + 비밀번호 있음. 실계정이 아니고 목이 켜져 있을 때만 존재한다.
 */
const STATE_PATH = 'e2e/.auth/user.json'

export const MOCK_ACCOUNT = {
  email: 'demo@hondigagae.dev',
  password: 'password123!',
  name: '김제주',
  /** 마이페이지 프로필 줄이 보이는 이름이다 — 이름이 아니라 닉네임을 쓴다 (#944) */
  nickname: '제주댕댕',
} as const

setup('일반 계정으로 로그인해 세션을 저장한다', async ({ page }) => {
  // `returnTo` 를 달고 들어간다 — 폼이 성공하면 `router.replace(returnTo)` 로 곧장 간다
  // (`login-form.tsx`). 로그인 뒤 따로 `goto` 하면 replace 전에 질러 경합이 난다.
  await page.goto('/login?returnTo=%2Fmypage')

  await page.locator('#email').fill(MOCK_ACCOUNT.email)
  await page.locator('#password').fill(MOCK_ACCOUNT.password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()

  /*
    **로그인 성공을 보호 라우트가 열리는 것으로 판정한다.** 폼이 오류를 안 냈다는 것만
    보면 쿠키가 비어도 통과할 수 있고, 그 상태로 저장된 `storageState` 는 뒤따르는 모든
    스펙을 `/login` 으로 보낸다 — 실패 지점이 여기서 멀어진다.
  */
  await expect(page).toHaveURL(/\/mypage$/)
  // 닉네임은 제목이 아니라 프로필 줄의 텍스트다 (`my-profile-section.tsx`, #944 부터 이름 대신).
  // 이 값이 보인다는 것은 세션 쿠키와 목 응답이 **둘 다** 성립했다는 뜻이다.
  await expect(page.getByText(MOCK_ACCOUNT.nickname, { exact: true })).toBeVisible()

  await page.context().storageState({ path: STATE_PATH })
})
