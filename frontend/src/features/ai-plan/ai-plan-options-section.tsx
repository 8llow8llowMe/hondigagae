'use client'

import Link from 'next/link'

import { Checkbox } from '@/components/checkbox'
import { CloseIcon } from '@/components/icons'
import { MAX_PINNED_PLACES } from '@/lib/ai-plan/pinned'
import { messages } from '@/lib/messages'
import type { PinnedPlace } from '@/types/ai-plan'

/**
 * 생성 옵션 확장 — 아트보드 `혼디가개 AI 일정 생성` 05 "입력 화면에 붙는 세 항목".
 *
 * 셋 중 **둘만** 있다. 다중 반려견은 조건 입력 화면이 체크박스 그룹으로 따로 갖고 있고,
 * 이 섹션은 그 축을 다루지 않는다 (명세 S8 · `다견선택-세부명세.md`).
 *
 * **"먼저" 와 "꼭" 을 갈라 쓴다.** `preferFavorites` 는 우선순위(조건이 맞을 때만),
 * `pinnedPlaceIds` 는 배치 보장이다. 아트보드가 두 문구를 섞지 말라고 못박았다 —
 * 지키지 못할 약속을 하면 결과를 못 믿게 된다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 */
export function AiPlanOptionsSection({
  preferFavorites,
  favoriteCount,
  pinnedPlaces,
  onPreferFavoritesChange,
  onRemovePinned,
  onOpenPicker,
}: {
  preferFavorites: boolean
  /**
   * 저장한 장소 개수. **`null` 은 "아직 모른다"**(조회 중·실패)이고 `0` 과 다르다 —
   * 0 이면 토글을 비활성하지만, 모를 때 비활성하면 조회가 느린 사용자에게는 저장한 곳이
   * 있어도 못 켜는 화면이 된다.
   */
  favoriteCount: number | null
  pinnedPlaces: PinnedPlace[]
  onPreferFavoritesChange: (next: boolean) => void
  onRemovePinned: (placeId: string) => void
  onOpenPicker: () => void
}) {
  const noFavorites = favoriteCount === 0

  return (
    <div className="flex flex-col gap-5">
      {/*
        **`h3` → `h4` 다** (#473). 이 구역은 접기 블록(`AiPlanDetailsDisclosure`) **안**에
        들어 있는데, 그 머리글이 카드 제목 `h2` 아래로 내려오며 `h3` 가 됐다. 여기가
        `h3` 로 남으면 자기를 담고 있는 접기와 같은 레벨이 되어, 문서 개요에서 접기의
        **다음 구역**으로 읽힌다. 건너뜀은 없었지만 포함 관계가 뒤집힌다.
      */}
      <h4 className="text-body-1 text-fg font-semibold">{messages.aiPlan.optionGroupLabel}</h4>

      <div className="flex flex-col gap-1">
        <Checkbox
          id="preferFavorites"
          label={messages.aiPlan.preferFavoritesLabel}
          /*
            개수를 모르는 동안에는 힌트를 숨긴다 — `저장한 0곳을 후보에 합치고` 가
            잠깐 스쳤다가 바뀌면 잘못된 사실을 먼저 보여 준 셈이 된다.
          */
          description={
            favoriteCount === null || noFavorites
              ? undefined
              : messages.aiPlan.preferFavoritesHint.replace('{count}', String(favoriteCount))
          }
          /*
            **0곳이면 비활성하되 숨기지 않는다** (아트보드 05). 숨기면 이 옵션의 존재를
            알 방법이 없어진다. 상한·부재는 언제나 비활성 + 이유 + 해결 방법이다.
          */
          checked={preferFavorites && !noFavorites}
          disabled={noFavorites}
          onCheckedChange={onPreferFavoritesChange}
        />

        {noFavorites ? (
          <div className="flex flex-col items-start gap-1 pl-8">
            <p className="text-caption text-fg-muted">{messages.aiPlan.preferFavoritesEmpty}</p>
            <Link
              href="/places"
              className="text-caption text-link focus-visible:ring-brand-500 inline-flex min-h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {messages.aiPlan.preferFavoritesEmptyAction}
            </Link>
          </div>
        ) : (
          <Link
            href="/favorites"
            className="text-caption text-link focus-visible:ring-brand-500 inline-flex min-h-11 items-center pl-8 font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {messages.aiPlan.preferFavoritesLink}
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-body-2 text-fg font-medium">{messages.aiPlan.pinnedLabel}</p>
          {/* 상한을 상시 노출한다 — 10곳에 닿아서야 알게 하지 않는다 (아트보드 05) */}
          <p className="text-caption text-fg-muted tabular-nums">
            {messages.aiPlan.pinnedCount
              .replace('{count}', String(pinnedPlaces.length))
              .replace('{max}', String(MAX_PINNED_PLACES))}
          </p>
        </div>

        {pinnedPlaces.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {pinnedPlaces.map((place) => (
              <li key={place.placeId}>
                {/*
                  칩이지만 `Chip` 을 쓰지 않는다 — `Chip` 은 필터 선택용(`selected` +
                  `onSelect`)이고 여기는 **이미 고른 것을 빼는** 제거 칩이다. 역할이 달라
                  같은 컴포넌트로 묶으면 `Chip` 에 제거 버튼 분기가 생긴다.
                */}
                <span className="bg-band text-fg text-caption flex items-center gap-1 rounded-full py-1 pr-1 pl-3 font-medium">
                  <span className="max-w-40 truncate">{place.title}</span>
                  <button
                    type="button"
                    onClick={() => onRemovePinned(place.placeId)}
                    aria-label={messages.aiPlan.pinnedRemoveLabel.replace('{title}', place.title)}
                    className="text-fg-muted hover:text-fg focus-visible:ring-brand-500 flex size-6 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <CloseIcon size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onOpenPicker}
          className="border-border-strong text-body-2 text-fg focus-visible:ring-brand-500 flex min-h-11 items-center justify-center rounded-md border border-dashed font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.aiPlan.pinnedAdd}
        </button>

        <p className="text-caption text-fg-muted">{messages.aiPlan.pinnedHint}</p>
      </div>
    </div>
  )
}
