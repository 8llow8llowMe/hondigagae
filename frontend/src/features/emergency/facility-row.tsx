'use client'

import { useId, useState } from 'react'

import { Badge } from '@/components/badge'
import { DirectionsIcon, PhoneIcon } from '@/components/icons'
import { formatDistance } from '@/lib/format/distance'
import { directionsUrl } from '@/lib/geo/map-link'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 긴급 시설 행 — 아트보드 `혼디가개 긴급 시설` 01.
 *
 * **약국을 따로 묶지 않는다.** 유형이 다르다고 섹션을 나누면 "4.46km 약국" 이
 * "3.12km 병원" 보다 위로 올라간다. 거리가 우선이고 유형은 태그로 구분한다
 * (아트보드 주석).
 *
 * **진료시간은 서버 문자열 그대로 렌더한다.** `"월~금 09:00~19:00, 토 09:00~13:00"` 을
 * 파싱해 "오늘 19:00까지" 로 요약하지 않는다 — 서식이 조금만 달라도 틀린 시간을 말하게 된다.
 * **#537 이 "오늘 기준 한 줄" 을 요구했을 때도 이 규칙은 그대로 두고 접기만 더했다**
 * (`FacilityHours`).
 *
 * **내용(`FacilityRowContent`)과 액션(`CallButton` · `DirectionsButton` · `DirectionsLink`)이
 * 갈려 있다.** 지도 패널은 내용만 선택 버튼으로 감싸고 액션은 그 **형제**로 둔다 —
 * `<a>` 를 `<button>` 안에 넣을 수 없다. 내용을 복제하면 두 목록의 행이 갈리므로
 * 여기서 공유한다.
 *
 * **구분선을 스스로 긋지 않는다** (3층 표면, #460). 2a 의 `Row` 는 `border-bottom` 을
 * 행에 걸고 마지막 행이 `last` 로 껐는데, 그러면 행 수를 아는 호출자만 목록을 그릴 수 있다.
 * 선은 `SurfaceList` 가 항목 **사이에만** 긋는다 (#439 가 정한 L2 규약).
 *
 * **좌우 인셋은 담는 곳이 정한다** (`inset.ts`). 목록 갈래는 카드 안이라 `card`(16/20),
 * 지도 SDK 폴백은 카드가 없어 `main`(16/40) — `PlaceRow` 와 같은 규칙이다. 자기 배경도
 * 없다: 카드 안 자식은 자기 배경을 갖지 않는다 (§0).
 */
export function FacilityRow({
  facility,
  /** 위치 폴백이면 거리를 숨긴다 — 제주 중심에서 480m 인 것을 "480m" 라고 쓸 수 없다 */
  showDistance,
  inset = 'card',
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  inset?: Inset
}) {
  return (
    <li className={INSET_CLASS[inset]}>
      <div className="flex items-center gap-3 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* 목록 행에만 접기를 준다 — 지도 패널은 이 내용을 `<button>` 안에 넣는다 */}
          <FacilityRowContent facility={facility} showDistance={showDistance} expandableHours />
        </div>

        {/*
          **전화 옆에 길찾기가 붙는다** (#537). 둘은 이 행에서 할 수 있는 두 가지 행동이고
          같은 무게라 나란히 둔다. `gap-2`(8)는 52px 버튼 둘이 오조작 없이 갈리는 최소값이다 —
          375 실측으로 글자 칸에 215px 가 남는다 (343 − 52 − 52 − 12 − 8 − 4).
        */}
        <div className="flex shrink-0 items-center gap-2">
          <CallButton name={facility.name} tel={facility.tel} />
          <DirectionsButton facility={facility} />
        </div>
      </div>
    </li>
  )
}

/**
 * 행이 보여주는 사실 — 이름 · 유형 · 영업 상태 · 진료시간 · 거리 · 주소.
 *
 * **링크도 버튼도 두지 않는다.** 호출부가 이것을 선택 버튼으로 감싸므로, 여기에
 * interactive content 가 있으면 중첩이 된다. 시설 상세 라우트가 없어(이슈 #148)
 * 제목을 링크로 만들 이유도 없다.
 *
 * `<div className="flex min-w-0 flex-1 flex-col gap-1.5">` 는 **호출부가 씌운다** —
 * 목록 행과 지도 패널 행에서 그 래퍼가 각각 다른 것(`div` / `button`)이어야 한다.
 */
export function FacilityRowContent({
  facility,
  showDistance,
  expandableHours = false,
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  /**
   * 운영시간을 접고 펼 수 있게 한다 (#537).
   *
   * **기본값이 `false` 인 것이 의도다.** 펼치기는 `<button>` 인데 지도 패널은 이 내용을
   * 통째로 선택 `<button>` 안에 넣는다 — 버튼 안의 버튼은 만들 수 없다. 접기가 필요한
   * 쪽(목록 행)이 명시적으로 켠다.
   */
  expandableHours?: boolean
}) {
  const meta = [
    showDistance ? formatDistance(facility.distanceMeters) : null,
    shortAddress(facility.addr),
  ].filter((part): part is string => part !== null && part !== '')

  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-title-2 text-fg font-semibold break-keep">{facility.name}</span>
        {/* 유형은 병원이 기본이라 약국일 때만 붙인다 — 모든 행에 붙으면 신호가 죽는다 */}
        {facility.facilityType.code === 'ANIMAL_PHARMACY' && (
          <Badge tone="neutral" size="sm" className="shrink-0">
            {facility.facilityType.name}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {facility.open24 && <Badge tone="neutral">{messages.emergency.open24}</Badge>}
        <OpenStatus openNow={facility.openNow} />
      </div>

      <FacilityHours facility={facility} expandable={expandableHours} />

      {meta.length > 0 && (
        <p className="text-body-2 text-fg-muted break-keep tabular-nums">{meta.join(' · ')}</p>
      )}

      {/* 번호가 없으면 이유와 다음 방법을 준다. 버튼만 비활성으로 두면 왜인지 알 수 없다 */}
      {facility.tel === null && (
        <p className="text-caption text-fg-muted break-keep">{messages.emergency.telMissing}</p>
      )}
    </>
  )
}

/**
 * 접힌 운영시간이 한 줄을 넘어가는 글자 수 기준.
 *
 * **높이를 재지 않고 글자 수로 가른다** (`PlaceOverview` 의 `COLLAPSE_THRESHOLD` 와 같은
 * 이유). 실제 높이는 렌더 후에만 알 수 있는데 그때 펼치기 버튼이 나타나면 버튼이 뒤늦게
 * 끼어들어 행이 밀린다. 서버 렌더와 클라이언트 렌더가 같은 결론을 내야 하이드레이션도
 * 어긋나지 않는다.
 *
 * 값의 근거는 375 실측이다. 글자 칸이 215px(`FacilityRow` 주석의 산식)이고 `text-body-2`
 * 한 줄에 24자쯤 들어간다. dev 실측에서 `연중무휴 24시간`(9자) · `월~금 09:00~19:00`(16자)는
 * 한 줄이고, `월~금 09:00~19:00, 토 09:00~13:00`(32자)부터 넘친다.
 */
const HOURS_COLLAPSE_THRESHOLD = 24

/**
 * 운영시간 한 줄 — **원문을 그대로 두고 접기만 한다** (#537).
 *
 * ── 파싱하지 않는 이유 (이슈가 "오늘 기준 한 줄" 을 요구했을 때 다시 확인한 것)
 *
 * 요일별 원문에서 오늘 구간만 뽑아 "오늘 09:30~20:00" 으로 적는 안은 기각돼 있다 —
 * 정본은 `types/emergency.ts` 의 `operatingHours` 주석이다. dev 실측이 그 근거를 그대로
 * 보여준다:
 *
 *     월~화, 목~금,토 09:30~20:00, 일 09:30~14:00   ← 요일 목록 + 범위, 공백 불규칙, 수요일 없음
 *     월~금 09:00~21:00, 토 09:00~21:00, 법정공휴일 09:00~21:00   ← 일요일 항목 자체가 없음
 *
 * 수요일에 첫 줄을 잘못 읽으면 **닫힌 병원으로 달려가게 된다.** 이 화면에서 가장 비싼
 * 실패라, 얻는 것(한 줄)보다 잃는 것이 크다.
 *
 * **"지금 여는가" 는 이 줄이 아니라 위의 `OpenStatus` 배지가 답한다** — 서버가 계산한
 * `openNow` 다. 이슈가 지적한 "급할 때 필요한 것은 지금 여는가" 는 이미 배지가 답하고
 * 있었고, 문제는 그 아래 원문이 카드 한 장을 네 줄로 불리는 것이었다. 그래서 고친 것은
 * **판정이 아니라 높이**다.
 *
 * ── 접기 방식
 *
 * `<details>` 가 아니라 `aria-expanded` + `aria-controls` 버튼이다 (`PlaceOverview` ·
 * `AiPlanDetailsDisclosure` 와 같은 방식). 짧아서 접을 것이 없는 곳에는 버튼을 두지
 * 않는다 — `연중무휴 24시간` 옆의 펼치기는 눌러도 아무 일이 없다.
 */
function FacilityHours({
  facility,
  expandable,
}: {
  facility: NearbyFacilityItem
  expandable: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()

  // 없으면 없다고 말한다 — "닫힘" 과 구분된다
  if (!facility.operatingHoursKnown || facility.operatingHours === null) {
    return <p className="text-body-2 text-fg-muted break-keep">{messages.emergency.hoursUnknown}</p>
  }

  /*
    **휴무를 같은 줄에 이어 붙인다.** 따로 줄을 만들면 접어서 번 한 줄을 도로 내놓는다.
    접힌 동안 `매주 수요일 휴무` 가 말줄임에 들어가는 것은 감수한다 — 휴무는 "오늘 여는가"
    가 아니라 "언제 닫는가" 라, 배지가 이미 오늘을 답한 뒤에 오는 사실이다.
  */
  const rest =
    facility.restDate === null ? null : ` · ${facility.restDate} ${messages.emergency.restPrefix}`

  const collapsible =
    expandable && (facility.operatingHours + (rest ?? '')).length > HOURS_COLLAPSE_THRESHOLD

  const text = (
    <>
      {facility.operatingHours}
      {rest !== null && <span className="text-fg-muted">{rest}</span>}
    </>
  )

  if (!collapsible) {
    /*
      **접지 않을 때도 `line-clamp-1` 이다.** 기준(24자)은 375 에서 잰 값이라 더 좁은
      화면이나 큰 글자 설정에서는 짧은 문자열도 넘칠 수 있다 — 그때 행이 소리 없이
      두 줄이 되는 것보다 한 줄을 지키는 쪽이 목록의 리듬을 지킨다. 지도 패널(`expandable`
      이 false)도 이 경로를 탄다.
    */
    return <p className="text-body-2 text-fg line-clamp-1 tabular-nums">{text}</p>
  }

  return (
    <div className="flex min-w-0 flex-col items-start">
      <p
        id={bodyId}
        className={cn('text-body-2 text-fg tabular-nums', expanded ? 'break-keep' : 'line-clamp-1')}
      >
        {text}
      </p>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((previous) => !previous)}
        // 44px — 급할 때 누르는 화면이라 최소 터치 영역을 지킨다 (DESIGN.md §7)
        className="text-caption text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {expanded ? messages.emergency.hoursCollapse : messages.emergency.hoursExpand}
      </button>
    </div>
  )
}

/**
 * 영업 상태 3상태 — `openNow` 가 근거다.
 *
 * **등급 색을 쓰지 않는다** (아트보드 주석). 초록·주황은 산책 위험도 전용이고
 * 영업 여부는 판정이 아니다. `null` 은 점선으로 "모름" 을 드러낸다.
 *
 * **장소 상세의 `PlaceOpenStatus` 와 합치지 않았다** (#294). 규칙(등급색 금지 · 색이
 * 아니라 무게)은 같지만 문구가 다르고(`진료중` vs `영업 중`) `null` 처리가 갈린다 —
 * 이 화면은 `operatingHoursKnown: false` 처럼 **원문조차 없는 곳**이 있어 "모름" 이
 * 정보지만, 장소는 운영시간 원문이 항상 함께 있어 정보가 아니다. 규칙을 바꿀 때는
 * 양쪽을 같이 본다.
 */
function OpenStatus({ openNow }: { openNow: boolean | null }) {
  if (openNow === null) {
    return (
      <span className="text-caption text-fg-muted border-border-strong inline-flex items-center rounded-sm border border-dashed px-2 py-1 font-semibold">
        {messages.emergency.statusUnknown}
      </span>
    )
  }

  return (
    // 진료중은 채운 태그, 영업 종료는 흐리게 — 색이 아니라 무게로 가른다
    <Badge tone="neutral" className={openNow ? 'text-fg font-semibold' : ''}>
      {openNow ? messages.emergency.statusOpen : messages.emergency.statusClosed}
    </Badge>
  )
}

/**
 * 52px 전화 버튼.
 *
 * **번호가 없어도 자리를 비우지 않는다.** 자리가 사라지면 "이 병원만 뭔가 다르다" 가
 * 아니라 "화면이 깨졌다" 로 읽힌다 (아트보드 주석).
 */
export function CallButton({ name, tel }: { name: string; tel: string | null }) {
  const base =
    'flex size-13 shrink-0 items-center justify-center rounded-md border transition-colors'

  if (tel === null) {
    return (
      <span aria-hidden className={cn(base, 'border-border text-fg-subtle')}>
        <PhoneIcon size={24} />
      </span>
    )
  }

  return (
    <a
      href={`tel:${tel.replace(/[^\d+]/g, '')}`}
      aria-label={messages.emergency.callLabel.replace('{name}', name)}
      className={cn(
        base,
        'border-border-strong text-fg hover:bg-band',
        // 테두리가 있으니 offset 0 · 1px — offset 을 주면 [테두리·흰틈·링] 세 겹이 된다
        // (DESIGN.md 포커스 링 표). 지운 `facility-selected-card` 의 같은 버튼이 쓰던 값이다
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
      )}
    >
      <PhoneIcon size={24} />
    </a>
  )
}

/**
 * 52px 길찾기 버튼 — **목록 행의 전화 옆** (#537).
 *
 * ── 예전에는 선택된 한 행에만 있었다
 *
 * 근거는 *"급할 때 누를 것이 둘이면 고르는 데 시간이 든다"* 였다(부동 카드 시절).
 * **#537 이 그 판단을 뒤집었다** — 실제로 급한 사용자가 하는 일은 "전화" 아니면 "출발"
 * 둘 중 하나로 이미 정해져 있고, 길찾기가 없으면 그 사용자는 주소를 외워 다른 앱에
 * 옮겨 적어야 했다. 고르는 데 드는 1초보다 앱을 옮겨 다니는 비용이 크다.
 *
 * 뒤집은 것은 **목록 행뿐이다.** 지도 패널은 그대로 선택된 행에만 `DirectionsLink` 를
 * 둔다 — 거기서는 행을 누르는 것이 "핀 고르기" 라 이미 선택이 주된 동작이고, 행마다
 * 링크를 붙이면 그 동작과 경쟁한다.
 *
 * **좌표가 없어도 자리를 비우지 않는다** — `CallButton` 과 같은 판단이다. 행마다 버튼
 * 개수가 달라지면 "이 병원만 뭔가 다르다" 가 아니라 "화면이 깨졌다" 로 읽힌다.
 * `DirectionsLink`(지도 패널)가 좌표 없을 때 아무것도 그리지 않는 것과 갈리는데,
 * 그쪽은 전폭 링크 한 줄이라 없으면 줄이 사라질 뿐 정렬이 흔들리지 않는다.
 */
export function DirectionsButton({ facility }: { facility: NearbyFacilityItem }) {
  const href = directionsUrl({ name: facility.name, lat: facility.lat, lng: facility.lng })

  const base =
    'flex size-13 shrink-0 items-center justify-center rounded-md border transition-colors'

  if (href === null) {
    return (
      <span aria-hidden className={cn(base, 'border-border text-fg-subtle')}>
        <DirectionsIcon size={24} />
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={messages.emergency.directionsLabel.replace('{name}', facility.name)}
      className={cn(
        base,
        'border-border-strong text-fg hover:bg-band',
        // 테두리가 있으니 offset 0 · 1px — `CallButton` 과 같은 이유다 (DESIGN.md 포커스 링 표)
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
      )}
    >
      <DirectionsIcon size={24} />
    </a>
  )
}

/**
 * 길찾기 전폭 링크 — **지도 패널의 선택된 한 행에만 나온다.**
 *
 * 노출 조건은 부동 카드 시절과 같다 (*"급할 때 누를 것이 둘이면 고르는 데 시간이
 * 든다"*). 그것을 담는 표면만 카드에서 행으로 옮겼다. **목록 행은 #537 에서 이 판단을
 * 뒤집고 `DirectionsButton` 을 항상 둔다** — 위 주석이 그 근거다.
 *
 * **경로 안내를 우리가 그리지 않는다** — 외부 지도 앱 딥링크다. 좌표가 없으면
 * `directionsUrl` 이 `null` 이고 아무것도 그리지 않는다.
 */
export function DirectionsLink({ facility }: { facility: NearbyFacilityItem }) {
  const href = directionsUrl({ name: facility.name, lat: facility.lat, lng: facility.lng })
  if (href === null) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'border-border-strong text-fg hover:bg-band flex h-11 items-center justify-center rounded-md border font-semibold transition-colors',
        // 위 `CallButton` 과 같은 이유로 offset 0 · 1px 이다 (DESIGN.md 포커스 링 표)
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
      )}
    >
      {messages.map.directions}
    </a>
  )
}
