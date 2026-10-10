'use client'

import type { Ref } from 'react'

import { EmergencyIcon } from '@/components/icons'
import type { FacilityLayerStatus } from '@/features/place/facility-layer-status'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 병원 · 약국 함께 보기 토글 (#1286, `docs/features/place/지도시설토글-세부명세.md` D4-1 · D5 · D6).
 *
 * **지도 도구 카드(`MapToolCard`)의 한 칸이다** (#1300 D1-2). 46 × 48 칸에 아이콘 20 + 간격 4 + 캡션
 * `병원·약국`(`.map-tool-caption` 10/12 · 600)을 세로로 쌓는다. 캡션은 **모든 폭에서 보이고** 그대로 접근 이름이
 * 된다 — 예전 `max-md` 아이콘 갈래 · `sr-only` 글자는 걷었다. 테두리 · 곡률 · 그림자는 카드가 갖는다.
 * 칸 경계까지 채움이 차고 카드가 `overflow-hidden` 이라 포커스 링은 안쪽이다.
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
          'focus-visible:ring-brand-500 flex h-12 w-full flex-col items-center justify-center gap-1 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
          on
            ? 'bg-fg text-fg-inverse'
            : // 끔은 바로 아래 `내 위치` 칸과 같은 낮춘 톤이다
              'text-fg-muted hover:bg-band hover:text-fg',
        )}
      >
        <EmergencyIcon size={20} />
        <span className="map-tool-caption whitespace-nowrap">{messages.map.facilityToggle}</span>
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
