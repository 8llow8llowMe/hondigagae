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

/**
 * **제출 실패 시 포커스가 화면의 첫 오류로 가는가** — 이슈 #560.
 *
 * ### 왜 e2e 인가
 *
 * 지키려는 것이 마크업이 아니라 **DOM 순서와 포커스**다. vitest 는 node 환경이라
 * `document` 도 effect 도 없어(`docs/testing-guide.md` §1) 이 회귀를 원리적으로 못 잡는다.
 * 실제로 못 잡았다 — `/plans/new` 는 스키마 키 선언 순서(`petId → title → startDate → …`)
 * 로 고른 첫 필드가 **제목**이라, 빈 채로 제출하면 위의 두 오류를 지나쳐 맨 아래로 갔다.
 *
 * ### 왜 `/plans/new` 인가
 *
 * **스키마 순서와 화면 순서가 어긋난 유일한 폼**이기 때문이다. `/ai-plans/new` 와
 * `/pets/new` 는 두 순서가 **우연히** 같아 증상이 없었다 — 즉 이 스펙이 지키는 것은
 * "이 화면이 맞다" 가 아니라 **"화면 순서를 바꿔도 포커스가 따라온다"** 는 성질이다.
 */
test.describe('제출 실패 시 첫 오류 포커스 (#560)', () => {
  test('빈 채로 제출하면 화면의 첫 오류로 간다 — 스키마 선언 순서를 따르지 않는다', async ({
    page,
  }) => {
    await page.goto('/plans/new')

    await page.getByRole('button', { name: '만들기', exact: true }).click()

    // 오류가 여럿 떠야 순서 판정이 의미를 갖는다. 하나뿐이면 어떤 규칙이든 통과한다
    await expect(page.locator('#startDate-error')).toBeVisible()
    await expect(page.locator('#endDate-error')).toBeVisible()
    await expect(page.locator('#title-error')).toBeVisible()

    // 화면 순서는 시작일 → 종료일 → 반려견 → 제목 → 예산 이다
    await expect(page.locator('#startDate')).toBeFocused()

    /*
      **오류 문구의 DOM 순서까지 함께 못박는다.** `#startDate` 하나만 단언하면 화면이
      재배치될 때 이 스펙이 조용히 낡는다 — 여기서 확인하는 성질은 "포커스가 **문서 순서상
      첫 오류**에 있다" 이므로 그 문서 순서도 같이 읽어 둔다.
    */
    const errorIds = await page
      .locator('main [id$="-error"]')
      .evaluateAll((nodes) => nodes.map((node) => node.id))
    expect(errorIds[0]).toBe('startDate-error')
  })
})
