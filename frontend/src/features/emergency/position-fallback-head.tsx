import type { ReactNode } from 'react'

import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import type { PositionFailure } from '@/lib/geo/current-position'
import { JEJU_REGION_CODES, type JejuRegionCode } from '@/lib/geo/jeju-regions'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type PositionFallbackHeadProps = {
  /**
   * 왜 폴백인가. **`null` 이면 아무것도 그리지 않는다** — 내 위치로 잘 돌고 있거나
   * (`granted`) 아직 묻는 중이다. 둘 다 이 블록이 할 말이 없는 상태다.
   */
  reason: PositionFailure | null
  /** 지금 고른 권역. `null` 이면 고르지 않았다 */
  regionCode: JejuRegionCode | null
  /** 같은 칩을 다시 누르면 `null` 이 온다 — 해제다 */
  onRegionChange: (next: JejuRegionCode | null) => void
  onLocate: () => void
  /** 좌우 인셋 — **담는 곳이 정한다** (`inset.ts`). 카드 머리가 기본이다 */
  inset?: Inset
  /**
   * `wide` 면 **lg 이상에서 두 줄로 접는다** (#910) — `[안내 · 힌트 | 버튼]` 과
   * `[권역 칩 | search]`. 목록 화면의 카드 머리(1024 이상에서 폭 1100 안팎)만 켠다.
   *
   * **기본값 `stack` 은 폭과 무관하게 한 줄씩 쌓는다.** 지도 화면의 데스크톱 패널은
   * 400px 고정 폭인데 `lg:` 는 **뷰포트** 기준이라, 켜 두면 그 좁은 패널 안에서 두 열로
   * 갈라진다 (`inset.ts` 의 `panel` 절과 같은 이유다).
   */
  layout?: 'stack' | 'wide'
  /**
   * 권역 칩 뒤에 서는 검색 폼 (#910). `wide` 에서 칩과 **같은 줄**에 서려면 이 블록 안에
   * 있어야 한다. 인셋은 이 블록이 주므로 넘기는 쪽은 인셋을 붙이지 않는다.
   *
   * 모바일 간격은 예전과 같다 — 예전에는 이 블록의 `pb-3` 과 검색 폼의 `pt-3` 이 칩과
   * 검색 사이 24 를 냈고, 지금은 검색 래퍼의 `mt-6` 이 같은 24 를 낸다. 검색이 들어오면
   * 블록의 `pb-3` 을 걷는다 — 검색 폼 아래는 원래 여백이 없었다.
   */
  search?: ReactNode
  /** 레이아웃 유틸리티만 (component-guide.md §3) */
  className?: string
}

/**
 * 위치를 쓸 수 없을 때의 **카드 머리 블록** — 이슈 #639 (UI/UX 감사 E-2).
 *
 * ### 왜 목록 위가 아니라 머리인가
 *
 * 예전 `PositionNotice` 는 목록 **본문 맨 위**에 얹혀 있었고 버튼이 `secondary` 였다.
 * 그래서 응급 화면에서 **가장 급한 행동이 화면에서 가장 낮은 위계**였고, 스크롤을 내리면
 * 통째로 사라졌다. 머리는 `Surface fill` 의 고정 영역이라 결과를 굴려도 남는다 —
 * "무엇을 기준으로 찾을지" 는 결과를 좁히는 도구가 아니라 **결과의 전제**다.
 *
 * ### 왜 세그먼트가 함께 있나
 *
 * 버튼 하나만 두면 막다른 길이 생긴다. 브라우저가 권한을 **영구 거부**한 상태에서는
 * 눌러도 프롬프트가 뜨지 않아 사용자가 같은 버튼을 반복해 누른다. 권역을 고르면 기준점이
 * 그 자리로 옮겨 가 **거리가 되살아난다** (`resolveAnchor` 의 `region`).
 *
 * **`unsupported` · `outside` 에는 버튼을 두지 않는다** (현행 규칙 유지 — 눌러도 같은 답).
 * 세그먼트는 그 둘에도 둔다: 제주 밖에서 여행을 계획하는 사람이 바로 세그먼트가 필요한
 * 사람이다.
 *
 * props 로만 받는 presentational 컴포넌트다 — node 환경에서 그대로 렌더해 잰다
 * (docs/testing-guide.md §1).
 */
export function PositionFallbackHead({
  reason,
  regionCode,
  onRegionChange,
  onLocate,
  inset = 'card',
  layout = 'stack',
  search,
  className,
}: PositionFallbackHeadProps) {
  if (reason === null) return null

  const text =
    reason === 'denied'
      ? messages.emergency.positionDenied
      : reason === 'unsupported'
        ? messages.emergency.positionUnsupported
        : reason === 'outside'
          ? messages.emergency.positionOutside
          : messages.emergency.positionTimeout

  // 눌러서 답이 달라질 수 있는 갈래만 — 미지원은 언제나 미지원이고 서울은 언제나 서울이다
  const canLocate = reason !== 'unsupported' && reason !== 'outside'
  const wide = layout === 'wide'

  return (
    <div
      className={cn(
        'flex flex-col gap-2 pt-3',
        search === undefined && 'pb-3',
        INSET_CLASS[inset],
        /*
          **lg 두 줄** (#910). 예전 데스크톱 머리는 안내 · 전폭 CTA · 힌트 · 권역 칩 · 검색이
          5단으로 쌓여 첫 행이 밀렸다 — 위치를 거부한 사용자가 대부분인데 가장 큰 요소가
          그 CTA 였다. 트리를 폭마다 나누지 않고 grid 자리만 바꾼다: 안내(1행) · 힌트(2행)가
          좌, 버튼이 우에서 두 행에 걸치고, 칩 줄이 3행 전폭이다. 모바일(#353)은 그대로다.
        */
        wide && 'lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-x-6 lg:gap-y-1',
        className,
      )}
    >
      {/*
        **`role="status"` 로 한 번 읽힌다** (D6). 예전 `PositionNotice` 에 없던 것이다 —
        급할 때 여는 화면에서 "왜 거리가 없나" 를 눈으로 찾게 하지 않는다.
      */}
      <p
        role="status"
        className={cn('text-body-2 text-fg break-keep', wide && 'lg:col-start-1 lg:row-start-1')}
      >
        {text}
      </p>

      {/*
        **전폭 primary 44px.** 이 화면에서 가장 급한 행동이라 위계가 가장 높아야 한다
        (DESIGN.md §7 — 급할 때 누르는 버튼을 작게 두지 않는다). `w-full` 은 레이아웃
        유틸리티라 `className` 으로 넘겨도 되는 값이다 (component-guide.md §3).
      */}
      {canLocate && (
        <Button
          onClick={onLocate}
          className={cn(
            'w-full',
            // lg 에서는 안내 옆 우측 — 전폭이 아니어도 44 높이와 primary 위계는 그대로다
            wide && 'lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:w-auto',
          )}
        >
          {messages.emergency.locateCta}
        </Button>
      )}

      {/*
        **힌트는 언제나 한 줄이다** (#671 F-6). 예전에는 `regionPickHint`(항상) 아래
        `positionDeniedHint`(거부일 때만)가 쌓여 **거부 갈래에서만 caption 이 두 줄**이었다.
        둘 다 위계가 같은 caption 이고 하는 말도 "남은 길" 하나라, 갈래마다 문구를 바꾸면
        될 자리를 줄을 늘려 풀고 있었다.

        실측이 그 한 줄을 비싸게 만든다: 권한 **허용** 시 `지금 진료중` 칩이 y=189 이고 첫
        화면에 전화 버튼이 2개인데, **거부** 시에는 y=395 로 밀려 전화 버튼이 1개만 남는다.
        위치를 못 쓰는 사람일수록 목록이 더 급한데 그쪽이 더 밀려나 있었다.

        **`timeout` 에 거부 문구를 띄우지 않는 규칙은 그대로다** — 엉뚱한 설정을 뒤지게
        한다. 갈래가 줄 수에서 문구로 옮겨 갔을 뿐이다.
      */}
      <p
        className={cn(
          'text-caption text-fg-muted break-keep',
          // lg 에서는 CTA 아래가 아니라 안내 문장 바로 아래 — 한 덩어리의 설명이다 (#910)
          wide && 'lg:col-start-1 lg:row-start-2',
        )}
      >
        {reason === 'denied'
          ? messages.emergency.regionPickHintDenied
          : messages.emergency.regionPickHint}
      </p>

      {/*
        **다중 축 칩(`aria-pressed`)이다 — `exclusive` 가 아니다.** 라디오 그룹은 한 번
        고르면 해제할 수 없는데, 여기서는 다시 눌러 제주 중심으로 돌아갈 수 있어야 한다
        (D4). 고른 것이 하나뿐인 것은 `onRegionChange` 가 지킨다.
      */}
      <div
        className={cn(
          'flex flex-col',
          wide && 'lg:col-span-2 lg:row-start-3 lg:mt-2 lg:flex-row lg:items-center lg:gap-4',
        )}
      >
        <ChipGroup
          label={messages.emergency.regionGroupLabel}
          className={cn('mt-1 flex flex-wrap gap-2', wide && 'lg:mt-0 lg:shrink-0')}
        >
          {JEJU_REGION_CODES.map((code) => (
            <Chip
              key={code}
              size="sm"
              selected={regionCode === code}
              onSelect={() => onRegionChange(regionCode === code ? null : code)}
            >
              {messages.emergency.regionLabel[code]}
            </Chip>
          ))}
        </ChipGroup>

        {search !== undefined && (
          <div className={cn('mt-6', wide && 'lg:mt-0 lg:min-w-0 lg:flex-1')}>{search}</div>
        )}
      </div>
    </div>
  )
}
