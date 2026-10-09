'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { CallButton, DirectionsLink, FacilityRowContent } from '@/features/emergency/facility-row'
import { type PlaceMapPreviewVariant, PreviewTopBar } from '@/features/place/place-map-preview-body'
import { messages } from '@/lib/messages'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 시설 요약 — 장소 미리보기 자리에 선다 (#1286, `docs/features/place/지도시설토글-세부명세.md` D4-3).
 *
 * **`/emergency` 지도 패널의 고른 행과 같은 조각을 쓴다** (`FacilityRowContent` · `CallButton` ·
 * `DirectionsLink`) — 두 화면의 시설 표현이 갈리지 않게. 페이지를 옮기지 않는다: 필터 · 재검색 영역 · 패널
 * 접힘이 그대로 남는다.
 *
 * **본문 맨 아래 `주변 병원·약국 더 보기` → `/emergency`** (#1300 D1-2 — #1286 D8-3 을 대체). 지도 아일랜드 알약에서
 * `병원 · 약국` 링크가 빠져 이 링크가 지도에서 `/emergency` 로 가는 길이다. `/emergency` 의 정규 주소(= 목록 보기)로
 * 보낸다 — "더 보기" 는 거리 · 영업 비교이고 그 화면의 기본이 목록인 이유와 같다(`긴급시설-목록우선-세부명세.md`
 * E-1). 고른 시설은 넘기지 않는다 — 그 화면의 선택은 URL 이 아니라 화면 상태다.
 *
 * - **거리를 쓰지 않는다** — 조회 중심이 제주시청이라 `distanceMeters` 는 사용자와 무관하다(D3-1)
 * - `openNow: null` 은 닫힘이 아니라 확인 필요다 — `FacilityRowContent` 가 이미 점선으로 그린다
 * - 면(배경 · 테두리 · 곡률)은 담는 쪽이 갖는다 — 장소 미리보기와 같은 자리 · 같은 면이다
 */
export function PlaceMapFacilitySummary({
  facility,
  variant,
  onClose,
  onBackToList,
  now = new Date(),
}: {
  facility: NearbyFacilityItem
  /** `panel` = 데스크톱 도킹 스택, `sheet` = 모바일 하단 시트 */
  variant: PlaceMapPreviewVariant
  /** ✕ — 요약을 닫고 포커스를 토글로 (D6) */
  onClose: () => void
  /** `‹ 목록`(1024~1279 패널) — 요약을 닫고 포커스를 목록으로 (D6). 주지 않으면 ✕ 와 같다 */
  onBackToList?: (() => void) | undefined
  /** 오늘 진료시간 한 줄의 기준 시각 — 테스트 이음새다(`FacilityRow` 와 같다) */
  now?: Date
}) {
  const inset = variant === 'sheet' ? 'px-4' : 'px-5'

  /*
    **포커스를 잃었을 때만 요약으로 데려온다** (D6). 핀은 고를 때 다시 그려져 포커스가 `body` 로 떨어지고,
    1024~1279 · 모바일은 목록이 가려진다 — 그 포커스를 이 요약이 받는다. 보이는 곳에 포커스가 살아 있으면
    (1280 목록을 훑는 중) 빼앗지 않는다 — 장소 미리보기와 같은 규칙. 패널 · 시트가 둘 다 마운트되므로 보이는
    쪽만 가져간다(숨은 쪽은 크기가 0).
  */
  const sectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const section = sectionRef.current
    if (section === null || section.getClientRects().length === 0) return

    const active = document.activeElement
    const lost =
      !(active instanceof HTMLElement) ||
      active === document.body ||
      active.getClientRects().length === 0 ||
      getComputedStyle(active).visibility === 'hidden'
    if (lost) section.focus()
  }, [facility.facilityId])

  return (
    <section
      ref={sectionRef}
      aria-label={messages.map.facilitySummaryLabel}
      tabIndex={-1}
      // 컨테이너 포커스라 링을 두지 않는다 — 안의 버튼 · 링크는 각자 링을 갖는다
      className="flex max-h-full min-h-0 flex-col focus:outline-none"
    >
      <PreviewTopBar
        variant={variant}
        onClose={onClose}
        onBackToList={onBackToList}
        closeLabel={messages.map.facilitySummaryClose}
      />

      <div className={`relative flex min-h-0 flex-col gap-4 overflow-y-auto pb-6 ${inset}`}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <FacilityRowContent facility={facility} showDistance={false} now={now} />
        </div>

        {/* 전화 + 길찾기(남는 폭 전부) — 지도 패널의 고른 행과 같은 두 행동이다 */}
        <div className="flex items-center gap-2">
          <CallButton name={facility.name} tel={facility.tel} />
          <div className="min-w-0 flex-1">
            <DirectionsLink facility={facility} />
          </div>
        </div>

        {/* 전화 칸은 비활성으로 남는다 — 이유를 글자로 준다 */}
        {facility.tel === null && (
          <p className="text-caption text-fg-muted font-medium">
            {messages.map.previewCallUnavailable}
          </p>
        )}

        <Link
          href="/emergency"
          className="text-link hover:text-link-hover focus-visible:ring-brand-500 text-body-2 inline-flex min-h-11 items-center gap-1 self-start rounded-sm font-semibold break-keep focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.map.facilityMoreNearby}
          <ChevronRightIcon size={16} />
        </Link>
      </div>
    </section>
  )
}
