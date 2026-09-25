'use client'

import { type ReactNode, useState } from 'react'

import { Surface } from '@/components/surface'
import { PLACE_ROWS_SPECIMEN } from '@/features/about/about-specimen-data'
import { Tag } from '@/features/about/tag'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 질문 1 의 고정 예시 — 내 반려견 기준 필터 + 장소 세 줄 (#635, 명세 §5-2).
 *
 * **필터 칩 둘이 실제로 눌린다** (#916, 명세 2026-09-25 §5). `실내` · `운영 중` 은
 * `aria-pressed` 토글이고, 켜면 조건에 안 맞는 행이 흐려진다. **행을 지우지 않는다** — 카드
 * 높이가 바뀌면 스크롤 무대의 기준(항목 윗변)이 밀린다. 첫 칩(`내 반려견 기준`)은 켜진 채
 * 고정된 표시라 버튼이 아니다. 상태는 URL 에 두지 않는다 — 목록 필터가 아니라 그림이다
 * (architecture-guide §10, `PlanSpecimen` 탭과 같은 이유).
 *
 * 칩은 28 높이 그대로 두고 누르는 자리만 44 로 넓힌다(`before:` — `Button` 과 같은 관례).
 * `::before` 는 패딩 상자 기준이라 1px 테두리가 있는 칩은 26 에서 넓어진다 — 위아래 10 씩
 * 넓혀 46 이다.
 *
 * **스크롤 무대의 단계는 `about-stage-*` 이름 클래스로 받는다** (#914, 명세 2026-09-25 §3-2).
 * 단계 1 칩 등장 · 행 정렬 → 단계 2 `정보 없음` 행 강조 → 단계 3 실내 · 실외 · `운영 중`
 * 을 남기고 나머지 태그(`about-stage-tag` · `about-stage-tag-unknown`)가 흐려진다.
 * 모양은 `app/globals.css` 의 소개 페이지 블록이 준다 — 이 파일은 선택자 훅만 단다. 외형
 * 클래스는 그대로라 무대 밖(정적 렌더)에서는 지금과 똑같이 보인다.
 *
 * **`Surface` 를 스스로 그린다.** 카드의 `aria-label` 과 모바일 full-bleed 가 이 예시의
 * 일부라, 호출자가 그것을 다시 적으면 두 곳이 갈린다.
 */
export type PlaceFilter = { indoor: boolean; open: boolean }

/**
 * 필터 → 행 흐림 (#916). 켠 조건에 하나라도 안 맞으면 흐린다 — 실내는 데이터의 `indoor`,
 * 운영 중은 `open` 이 있는지. 순수 함수로 뗀 이유: node 테스트는 클릭 경로를 못 돌려 조합을
 * 여기서 잠근다.
 */
export function isPlaceDimmed(
  row: (typeof PLACE_ROWS_SPECIMEN)[number],
  filter: PlaceFilter,
): boolean {
  return (filter.indoor && !row.indoor) || (filter.open && !('open' in row))
}

export function PlacesSpecimen() {
  const specimen = messages.about.specimen
  const [filter, setFilter] = useState<PlaceFilter>({ indoor: false, open: false })

  return (
    <Surface aria-label={specimen.placesAria} className="-mx-4 md:mx-0">
      <div className={cn('flex flex-wrap gap-1.5 pt-4', INSET_CLASS.card)}>
        <Chip active className="about-stage-chip">
          {specimen.placesChip}
        </Chip>
        <ToggleChip
          pressed={filter.indoor}
          onToggle={() => setFilter((current) => ({ ...current, indoor: !current.indoor }))}
        >
          {specimen.filterIndoor}
        </ToggleChip>
        <ToggleChip
          pressed={filter.open}
          onToggle={() => setFilter((current) => ({ ...current, open: !current.open }))}
        >
          {specimen.filterOpen}
        </ToggleChip>
      </div>
      <ul className={cn('pt-3 pb-4', INSET_CLASS.card)}>
        {PLACE_ROWS_SPECIMEN.map((row, index) => (
          <li
            key={row.name}
            className={cn(
              // 흐림의 전환은 `globals.css` `.about-stage-row` 가 준다(층 없는 CSS 라 유틸리티를 이긴다)
              'about-stage-row flex items-center gap-3 py-3',
              isPlaceDimmed(row, filter) && 'opacity-30',
              'unknown' in row && 'about-stage-row-unknown',
              index > 0 && 'border-border border-t',
            )}
          >
            {/* 썸네일 자리 — 예시라 이미지를 싣지 않는다 */}
            <span aria-hidden className="bg-band size-12 shrink-0 rounded-md" />
            <div>
              <p className="text-body-1 text-fg">{row.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {'unknown' in row && (
                  <Tag tone="unknown" className="about-stage-tag-unknown">
                    {specimen.unknownTag}
                  </Tag>
                )}
                {row.tags.map((tag) => (
                  <Tag key={tag} tone="neutral" className="about-stage-tag">
                    {tag}
                  </Tag>
                ))}
                <Tag tone="neutral" className="about-stage-tag-live">
                  {row.setting}
                </Tag>
                {'open' in row && (
                  <Tag tone="open" className="about-stage-tag-live">
                    {specimen.filterOpen}
                  </Tag>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className={cn('text-caption text-fg-muted pb-4 font-medium', INSET_CLASS.card)}>
        {specimen.placesNote}
      </p>
    </Surface>
  )
}

/** 누르는 필터 칩 — 켜지면 고정 칩과 같은 채움 모양이다 */
function ToggleChip({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'about-stage-chip',
        CHIP_SHAPE,
        "relative before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-['']",
        // 색 전환은 `globals.css` `.about-stage-chip` 이 준다(유틸리티 transition 은 거기서 진다)
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
        pressed ? CHIP_ON : CHIP_OFF,
      )}
    >
      {children}
    </button>
  )
}

const CHIP_SHAPE = 'text-caption inline-flex h-7 items-center rounded-full px-3 font-semibold'
const CHIP_ON = 'bg-fg text-fg-inverse border border-transparent'
const CHIP_OFF = 'border-border-strong text-fg border'

/**
 * 고정 칩 — 켜진 채 고정된 표시(내 반려견 기준)다. 누를 수 없다.
 *
 * **이 파일 밖으로 내보내지 않는다.** 장소 목록의 실제 필터 칩
 * (`place-filter-chips.tsx`)은 누를 수 있고 URL 을 바꾸는 다른 것이다 — 그림과 계약을
 * 한 이름으로 묶으면 둘 중 하나가 끌려다닌다.
 */
function Chip({
  active = false,
  className,
  children,
}: {
  active?: boolean
  /** 무대 선택자 훅(`about-stage-chip`)만 받는다 — 외형을 덮지 않는다 */
  className?: string
  children: ReactNode
}) {
  return <span className={cn(CHIP_SHAPE, active ? CHIP_ON : CHIP_OFF, className)}>{children}</span>
}
