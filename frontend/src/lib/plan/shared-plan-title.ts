import type { Metadata } from 'next'

import { classify, toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { BRAND_SHARE_IMAGE } from '@/lib/seo/page-metadata'
import { SITE_NAME } from '@/lib/seo/site'

/**
 * 공유 링크 열람 화면의 `<title>` — 이슈 #980 → #1186. `error` 가 `null` 이면 조회 성공이다.
 *
 * **유효한 링크는 일정 이름이다** (#1186 · 사용자 결정 2026-10-07). 메신저로 링크를 보내면 미리보기가
 * 서비스 공통 카드라 받는 사람이 무엇을 받았는지 열기 전까지 몰랐다(2회차 사용성 점검). 예전(#980)에는
 * "일정 이름은 사적 문자열이라 히스토리 · 탭으로 샌다" 며 오류만 받았는데, 공유 링크는 이미 "링크를 아는
 * 사람은 로그인 없이 일정을 본다" 는 공개 범위라 **이름 하나**는 그 범위를 넓히지 않는다. 기간 · 예산 ·
 * 메모는 싣지 않는다 — 이 함수에는 이름만 넘어온다.
 *
 * - **404 → `sharedNotFoundTitle`.** 없는 토큰·폐기·삭제·초안 회귀가 전부 404 로 같게 온다.
 * - **410 → `sharedExpiredTitle`.** 만료는 상태가 200 으로 남는 갈래라(D8-2) 탭 제목이
 *   상태를 말하는 유일한 신호다. 404 와 다른 말이어야 한다(본문도 갈린다).
 * - **성공 → 일정 이름**(비었으면 `sharedPageTitle`). **5xx·무응답·그 밖 → `sharedPageTitle`.** 5xx 뒤
 *   `error.tsx` 의 재시도가 성공하면 멀쩡한 일정 화면의 탭에 실패 문구가 남는다 — 단정하지 않는다
 *   (`architecture-guide.md` §7 #206, `src/lib/plan/detail-title.ts` 와 같은 축).
 *
 * `generateMetadata` 안에 두면 테스트할 수 없어 뽑아냈다 (`testing-guide.md` §1).
 */
export function sharedPlanPageTitle(error: unknown, planTitle: string | null = null): string {
  const status = toErrorStatus(error)
  if (status === null) return planTitle?.trim() || messages.plan.sharedPageTitle

  switch (classify(status)) {
    case 'not-found':
      return messages.plan.sharedNotFoundTitle
    case 'gone':
      return messages.plan.sharedExpiredTitle
    default:
      return messages.plan.sharedPageTitle
  }
}

/**
 * 공유 미리보기(OG) — **유효한 링크에만** 낸다 (#1186). 무효 · 만료 · 장애면 `undefined` 라 루트의 서비스
 * 공통 카드를 그대로 상속한다 — 열리지 않는 링크에 일정이 있는 것처럼 말하지 않는다.
 *
 * **`openGraph` 는 통째로 갈아끼워진다**(Next 메타데이터는 키 단위 얕은 병합) — 그래서 사이트 이름 · 이미지까지
 * 여기서 다시 싣는다. 제목은 일정 이름, 설명은 무엇을 받았는지만 말한다. **`url` 은 두지 않는다** — 토큰
 * 주소가 곧 열람 권한이라 메타 태그에 한 번 더 박을 이유가 없다(`noindex` 화면이다).
 */
export function sharedPlanOpenGraph(planTitle: string | null): Metadata['openGraph'] {
  const title = planTitle?.trim()
  if (!title) return undefined

  return {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    title,
    description: messages.plan.sharedOgDescription,
    images: [BRAND_SHARE_IMAGE],
  }
}
