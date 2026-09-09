import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import type { PlanAddTarget } from '@/features/plan/use-plan-add-place'
import { messages } from '@/lib/messages'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import type { PlaceSummary } from '@/types/place'

/**
 * 지도 패널 행의 담기 액션과 실패 알림.
 *
 * **`PlanAddPlaceRow` 와 같은 동작·문구다.** 두 보기에서 같은 일을 하는데 글자가 갈리면
 * 안 된다. 행 마크업 자체는 `PlaceMapPanel` 이 갖고 있어 재사용할 수 없어서, 겹치는
 * 액션 조각을 여기에 **따로 두었다.**
 *
 * **같은 조각이 네 곳에 있다 — 고칠 때 같이 봐야 한다.** 다만 **겹침 정도가 다르다:**
 *
 *  1. 이 파일 (`plan-add-place-action.tsx`) — 지도 패널·시트 행의 액션 열
 *  2. `plan-add-place-row.tsx` — 담기 화면 목록 보기의 행
 *  3. `plan-indoor-alts.tsx` — 비 예보 일자의 실내 대안 행
 *  4. `place-add-to-plan-picker.tsx` — 장소 상세에서 여는 담기 시트의 일자 버튼
 *
 * **1·2·3 만 문자 단위로 겹친다** — `messages.plan.addPlaceAlready` 대체, 담기 버튼의
 * `messages.plan.addPlaceShort`, `disabled={disabled && !pending}` 가 그대로 같다.
 * **4 는 `messages.plan.addPlaceAlready` 하나만 공유한다** — 일자 버튼이라 담기 버튼도
 * 그 disabled 규칙도 없다.
 *
 * 하나로 합치려면 네 곳의 행 구조를 전부 건드려야 하고 이 브랜치가 만든 중복도 아니라서
 * #370 범위를 넘겼다.
 *
 * **컴포넌트가 아니라 함수다.** `PlaceMapPanel` 의 `renderRowAction` 이 `ReactNode` 를
 * 받으므로 훅 없이 props 로만 도는 함수면 충분하고, 그래야 node 환경에서 문자열
 * assertion 으로 테스트할 수 있다.
 */
export function planAddPlaceAction(
  place: PlaceSummary,
  {
    addedPlaceIds,
    pendingPlaceId,
    disabled,
    onAdd,
  }: {
    /** **그 일자에** 이미 담긴 장소들. 서버가 중복을 막지 않아 화면이 막는다 (F5-4) */
    addedPlaceIds: ReadonlySet<string>
    pendingPlaceId: string | null
    /** 다른 담기가 진행 중 — 일괄 교체라 동시에 두 개를 보내면 하나가 진다 */
    disabled: boolean
    onAdd: (place: PlaceSummary) => void
  },
) {
  if (addedPlaceIds.has(place.placeId)) {
    return (
      <span className="text-caption text-fg-muted font-medium">
        {messages.plan.addPlaceAlready}
      </span>
    )
  }

  const pending = pendingPlaceId === place.placeId

  return (
    <Button
      variant="secondary"
      // 이 화면의 주 행동이라 44px 를 준다 — sm(32px)은 최소 터치 영역 미만이다
      size="md"
      loading={pending}
      disabled={disabled && !pending}
      aria-label={messages.plan.addPlaceLabel.replace('{title}', place.title)}
      onClick={() => onAdd(place)}
    >
      {messages.plan.addPlaceShort}
    </Button>
  )
}

/**
 * 실패는 **누른 그 자리**에 남는다 (F4). 화면 위쪽에 모아 두면 무한 스크롤 아래에서
 * 담다 실패했을 때 알림이 화면 밖이라 아무 일도 안 일어난 것처럼 보인다.
 */
export function planAddPlaceNotice(
  place: PlaceSummary,
  { failure }: { failure: { target: PlanAddTarget; error: PlanDaySaveError } | null },
) {
  if (failure === null || failure.target.placeId !== place.placeId) return null

  return (
    <FormAlert
      className="mx-4 mb-3"
      message={
        failure.error.retriable
          ? `${messages.plan.addPlaceErrorTitle} ${failure.error.message}`
          : failure.error.message
      }
    />
  )
}
