'use client'

import type { Ref } from 'react'

import { EmergencyIcon } from '@/components/icons'
import type { FacilityLayerStatus } from '@/features/place/facility-layer-status'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 병원 · 약국 함께 보기 토글 (#1286, `docs/features/place/지도시설토글-세부명세.md` D4-1 · D5 · D6).
 *
 * **모양은 `ViewToggle` `md` 와 한 벌이다** — 같은 세로 묶음(`목록 보기` · `내 위치`)에 서므로 높이 44 ·
 * `rounded-lg` · `bg-bg` · `border-border` · `shadow-md` 를 같게 둔다. `md` 미만은 44 정사각 아이콘이고 글자는
 * `sr-only` 로 남는다(#1272 와 같은 규칙).
 *
 * **켬은 반전이다** (`bg-fg` · `text-fg-inverse`) — 색상(hue)이 아니라 명도로 가른다. 상태는 `aria-pressed` 가
 * 말하고, **접근 이름은 켬 · 끔에 따라 바꾸지 않는다** — 이름이 바뀌면 "누르면 무엇이 되나" 와 "지금 무엇인가"
 * 가 섞인다.
 *
 * **숨은 상태 알림을 늘 둔다** (`role="status"`). 나타났다 사라지는 live region 은 읽히지 않는다 — 자리는 그대로
 * 두고 글자만 바꾼다.
 */
export function PlaceMapFacilityToggle({
  on,
  status,
  onToggle,
  ref,
}: {
  on: boolean
  status: FacilityLayerStatus
  onToggle: () => void
  /** 요약을 ✕ 로 닫으면 포커스가 여기로 돌아온다 (D6) */
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        aria-busy={status.kind === 'loading'}
        title={messages.map.facilityToggle}
        className={cn(
          'text-body-2 focus-visible:ring-brand-500 inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-4 font-semibold whitespace-nowrap shadow-md transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none max-md:w-11 max-md:px-0',
          on
            ? 'bg-fg text-fg-inverse border-fg'
            : // 모바일 아이콘은 바로 아래 `내 위치` 와 같은 낮춘 톤이다
              'bg-bg border-border text-fg hover:bg-band max-md:text-fg-muted',
        )}
      >
        <EmergencyIcon size={18} />
        <span className="max-md:sr-only">{messages.map.facilityToggle}</span>
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {facilityStatusText(status)}
      </span>
    </>
  )
}

/** 숨은 상태 알림의 글자. 실패는 안내 카드(`role="alert"`)가 말하므로 여기서는 비운다 */
export function facilityStatusText(status: FacilityLayerStatus): string {
  if (status.kind === 'loading') return messages.map.facilityLoading
  if (status.kind === 'shown') {
    return messages.map.facilityShown.replace('{n}', String(status.count))
  }
  return ''
}

/**
 * 안내 카드가 서는가 — 잘림 · 실패. 호출부가 **카드가 있을 때만 줄(래퍼)을 둔다** — 빈 래퍼의 `pt-2` 가 모바일
 * 재검색 알약을 8px 밀어 내렸다(리뷰 7). `PlaceMapFacilityNotice` 도 이 판정으로 비운다 — 둘이 갈리지 않는다.
 */
export function hasFacilityNotice(status: FacilityLayerStatus): boolean {
  return status.kind === 'failed' || (status.kind === 'shown' && status.truncated)
}

/**
 * 토글 아래 안내 카드 — 잘림 · 실패 (D5). **토스트가 아니다** — 다시 시도할 자리가 남아야 한다(`toast.tsx`).
 *
 * - 잘림: 받은 만큼 그렸다는 사실만 말한다. 닫기 없음 — 끄면 사라진다
 * - 5xx · 무응답: `다시 시도`. 훅이 이미 1회 재시도한 뒤의 실패다
 * - 4xx: 서버 문구(없으면 일반 문구) · **재시도 없음**
 *
 * 실패해도 토글을 끄지 않는다 — 사용자의 뜻(켬)을 지우면 "눌렀는데 안 눌린" 버튼이 된다.
 */
export function PlaceMapFacilityNotice({
  status,
  onRetry,
}: {
  status: FacilityLayerStatus
  onRetry: () => void
}) {
  const card =
    'bg-bg border-border text-body-2 text-fg pointer-events-auto max-w-xs rounded-lg border px-3 py-2 break-keep shadow-md'

  if (!hasFacilityNotice(status)) return null

  if (status.kind === 'shown') {
    return (
      <p className={card}>{messages.map.facilityTruncated.replace('{n}', String(status.count))}</p>
    )
  }

  if (status.kind !== 'failed') return null

  return (
    <p role="alert" className={card}>
      {status.message}
      {status.retry && (
        <>
          {' '}
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              'text-link hover:text-link-hover rounded-md font-semibold',
              'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
              // 누르는 자리 44 를 만들되 줄 높이에는 남기지 않는다 — `PositionNotice` 와 같은 수법
              '-my-3 px-1 py-3',
            )}
          >
            {messages.common.retry}
          </button>
        </>
      )}
    </p>
  )
}
