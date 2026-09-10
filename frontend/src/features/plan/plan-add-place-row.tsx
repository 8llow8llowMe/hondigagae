'use client'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { PlaceRowContent } from '@/features/place/place-row'
import { messages } from '@/lib/messages'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import { INSET_CLASS } from '@/lib/ui/inset'
import type { PlaceSummary } from '@/types/place'

/**
 * 일정에 담는 목록의 행 — 아트보드 없음(F2 가 새로 정한 화면).
 *
 * **행 전체를 링크로 감싸지 않는다.** `<a>` 안에 `<button>` 을 넣을 수 없기 때문이다.
 * 대신 **제목만 링크**로 두어 담기 전에 장소를 확인할 수 있게 한다 — 목록 응답에는 적합도가
 * 없어서(`screen-inventory.md` §3) 이름·주소·태그만으로 판단해야 하는데, 그것만으로
 * 결정하라고 하는 것은 "의사결정 지원" 이 아니다 (DESIGN.md §1). 뒤로가기로 돌아온다.
 *
 * **액션 열은 고정 폭이다.** `담기` 버튼과 `이미 담았어요` 문구는 폭이 달라, 감싸지 않으면
 * 앞의 내용 열이 행마다 15px 씩 밀려 제목·태그의 우측 정렬이 들쭉날쭉해진다 (실측).
 * 목록은 훑는 것이라 열이 흔들리면 못 쓴다 (`place-row.tsx` 의 같은 판단).
 */
export function PlanAddPlaceRow({
  place,
  added,
  pending,
  disabled,
  error,
  onAdd,
}: {
  place: PlaceSummary
  /** **그 일자에** 이미 담겼다. 서버가 중복을 막지 않아 화면이 막는다 (F5-4) */
  added: boolean
  pending: boolean
  /** 다른 담기가 진행 중 — 일괄 교체라 동시에 두 개를 보내면 하나가 진다 */
  disabled: boolean
  /**
   * **이 행에서** 난 실패. 화면 위쪽에 모아 두면 무한 스크롤 아래에서 담다 실패했을 때
   * 알림이 화면 밖이라 아무 일도 안 일어난 것처럼 보인다 — 토스트를 버린 이유가 그대로
   * 무력화된다 (F4).
   */
  error: PlanDaySaveError | null
  onAdd: (place: PlaceSummary) => void
}) {
  return (
    /*
      **이 화면은 아직 3a 로 옮기지 않았다.** 목록이 카드 안이 아니라 페이지 위에 있어
      인셋이 카드 값(16/20)이 아니라 페이지 값(16/40)이다 — 옮길 때 `INSET_CLASS.card`
      로 바꾼다. 구분선은 `SurfaceList` 가 항목 사이에만 그으므로 `last` 는 없다.
    */
    <li className={INSET_CLASS.main}>
      <div className="@container flex items-center gap-3 py-3 @lg:gap-5 @lg:py-4">
        <PlaceRowContent place={place} titleHref={`/places/${place.placeId}`} />

        {/* w-24 고정 — 버튼이든 문구든 앞 열의 폭이 변하지 않는다 */}
        <div className="flex w-24 shrink-0 justify-end">
          {added ? (
            <span className="text-caption text-fg-muted font-medium">
              {messages.plan.addPlaceAlready}
            </span>
          ) : (
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
          )}
        </div>
      </div>

      {error !== null && (
        <FormAlert
          className="mb-3"
          message={
            error.retriable ? `${messages.plan.addPlaceErrorTitle} ${error.message}` : error.message
          }
        />
      )}
    </li>
  )
}
