import type { ReactNode } from 'react'

import { Surface } from '@/components/surface'
import { PLACE_ROWS_SPECIMEN } from '@/features/about/about-specimen-data'
import { Tag } from '@/features/about/tag'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 질문 1 의 고정 예시 — 내 반려견 기준 필터 + 장소 세 줄 (#635, 명세 §5-2).
 *
 * **서버 컴포넌트다.** 상태가 없다 — 칩도 행도 누를 수 없는 그림이라 `'use client'` 가
 * 필요 없다.
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
export function PlacesSpecimen() {
  const specimen = messages.about.specimen

  return (
    <Surface aria-label={specimen.placesAria} className="-mx-4 md:mx-0">
      <div className={cn('flex flex-wrap gap-1.5 pt-4', INSET_CLASS.card)}>
        <Chip active className="about-stage-chip">
          {specimen.placesChip}
        </Chip>
        <Chip className="about-stage-chip">{specimen.filterIndoor}</Chip>
        <Chip className="about-stage-chip">{specimen.filterOpen}</Chip>
      </div>
      <ul className={cn('pt-3 pb-4', INSET_CLASS.card)}>
        {PLACE_ROWS_SPECIMEN.map((row, index) => (
          <li
            key={row.name}
            className={cn(
              'about-stage-row flex items-center gap-3 py-3',
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

/**
 * 필터 칩 — `active` 는 켜진 칩(내 반려견 기준) 하나뿐이다.
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
  return (
    <span
      className={cn(
        'text-caption inline-flex h-7 items-center rounded-full px-3 font-semibold',
        active ? 'bg-fg text-fg-inverse' : 'border-border-strong text-fg border',
        className,
      )}
    >
      {children}
    </span>
  )
}
