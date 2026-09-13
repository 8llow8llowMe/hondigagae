import { expect, test } from '@playwright/test'

/**
 * **서버가 내린 필드 오류가 그 입력칸 밑에 붙는가** — 이슈 #501 (서버 쪽 #491).
 *
 * ### 왜 e2e 인가
 *
 * 계약이 통일되면서 `dataHeader.resultMessage` 가 **검증 실패에서도 문자열**이 됐고,
 * 필드 목록은 `fieldErrors` 로 빠졌다. 문자열을 먼저 보고 반환하던 `toFormErrors()` 는
 * 그 순간부터 `fields` 를 영원히 비웠고, **모든 폼의 입력칸별 오류가 폼 전체 알럿
 * 한 줄로 퇴화했다.**
 *
 * `pnpm verify` 가 이것을 못 잡았다 — `field-errors.test.ts` 가 옛 봉투를 **입력으로
 * 직접 만들어** 검증해서, 서버가 형태를 바꿔도 계속 초록이었다. 유닛 테스트를 새 형태로
 * 다시 썼지만 그것도 결국 **손으로 적은 입력**이다. 이 스펙이 지키는 것은 그 위층이다:
 * **mock 이 실제로 내보낸 봉투**가 API 클라이언트 → `ApiError` → `toFormErrors` →
 * `Field` 까지 흘러 입력칸 밑에 문구로 나오는지.
 *
 * ### 왜 회원가입 인증코드인가
 *
 * 폼 스키마는 백엔드 제약의 복제본이라(`docs/form-guide.md` §5) 대부분의 검증은
 * 요청이 나가기 전에 클라이언트가 막는다 — **서버 오류 경로를 브라우저에서 밟을 수 없다.**
 * 틀린 인증코드(`AUTH_004`)는 다르다: 클라이언트는 "비어 있지 않다" 만 보고 통과시키고,
 * **맞고 틀림은 서버만 안다.** 이 저장소가 가진 "클라이언트가 통과시키는 서버 필드 오류"
 * 경로다.
 */
test.describe('서버 필드 오류 렌더 (#501)', () => {
  // 회원가입은 로그인 상태에서 들어갈 화면이 아니다 — 저장된 세션을 쓰지 않는다
  test.use({ storageState: { cookies: [], origins: [] } })

  test('틀린 인증코드는 코드 입력칸 밑에 붙는다 — 폼 전체 알럿으로 퇴화하지 않는다', async ({
    page,
  }) => {
    await page.goto('/signup')

    // 1단계 — 코드 발송
    await page.getByLabel('이메일').fill('new-user@hondigagae.dev')
    await page.getByRole('button', { name: '인증코드 받기' }).click()

    const codeInput = page.getByLabel('인증코드')
    await expect(codeInput).toBeVisible()

    // 2단계 — mock 의 고정 코드(A3K7MP2X)가 아닌 값. 형식은 맞아 클라이언트를 통과한다
    await codeInput.fill('ZZZZZZZZ')
    await page.getByRole('button', { name: '확인', exact: true }).click()

    /*
      **입력칸과 오류가 `aria-describedby` 로 실제로 이어져 있는지까지 본다.**
      문구가 화면 어딘가에 있는 것으로는 부족하다 — 폼 전체 알럿에 같은 문장이 떠도
      통과해 버려서, 이 이슈가 만든 퇴화를 그대로 놓친다.
    */
    // `getAttribute()` 는 재시도하지 않는다 — 제출은 비동기라 한 번 읽으면 렌더 전 값을 본다
    await expect(codeInput).toHaveAttribute('aria-describedby', 'code-error')
    await expect(codeInput).toHaveAttribute('aria-invalid', 'true')

    const fieldError = page.locator('#code-error')
    await expect(fieldError).toBeVisible()
    await expect(fieldError).not.toBeEmpty()

    /*
      필드 오류가 잡혔으면 대표 메시지를 또 띄우지 않는다 (form-guide.md §4.2).
      **`main` 안으로 좁힌다** — `next dev` 오버레이가 문서 끝에 자기 `alert` 을 둔다.
    */
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)

    // 재입력을 유도하려고 코드만 비우고 포커스한다 — 오류는 남아야 한다 (D4)
    await expect(codeInput).toHaveValue('')
    await expect(codeInput).toBeFocused()
  })
})
