'use client'

import { Badge } from '@/components/badge'
import { DirectionsIcon, PhoneIcon } from '@/components/icons'
import { summarizeTodayHours, todayHoursLabel } from '@/lib/emergency/operating-hours'
import { formatDistance } from '@/lib/format/distance'
import { directionsUrl } from '@/lib/geo/map-link'
import { messages } from '@/lib/messages'
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
 * **진료시간은 읽을 수 있을 때만 오늘 한 줄로 줄인다** (#654 E-4). 읽지 못하면 서버
 * 문자열을 그대로 그린다 — 지키는 것은 "파싱하지 않는다" 가 아니라 **"틀린 시간을 말하지
 * 않는다"** 이고, 그 불변식은 `lib/emergency/operating-hours.ts` 가 세 겹으로 세운다
 * (상태는 서버 `openNow` 만 · 못 읽으면 침묵 · 서버와 어긋나면 버린다). #537 · #598 이
 * 두 번 기각한 것은 **검증 없는** 파싱이었다 (`FacilityHours` 머리주석).
 *
 * **접기는 두지 않는다.** 접을 것이 원문 한 필드뿐이라 펼쳐도 같은 데이터가 나온다
 * (`FacilityHours` 머리주석). 그래서 목록 행과 지도 패널의 진료시간 렌더가 **같다**.
 *
 * ── **2단이 아니라 2층이다** (#603)
 *
 * 예전에는 `[내용 | 버튼]` 한 층이라 버튼 칸이 **제목 줄의 폭까지 먹었다.** 375 기준으로
 * 제목 줄에 343 − 52 − 52 − 12 − 8 = 219px 만 남았고, 그 좁은 칸에서 이름과 상태 배지가
 * 자리를 다투느라 #598 이 `basis-[min-content]` 로 줄바꿈을 따로 설계해야 했다.
 *
 * 이제 **머리(`FacilityRowHeader`)가 전폭 343px 을 쓰고**, 그 아래 층만 좌우로 갈라
 * `[시간·주소 243px | 버튼 88px]` 이 된다. 버튼은 제목과 같은 줄에 있을 이유가 없다 —
 * 제목은 "무엇인가" 이고 버튼은 "어떻게 갈 것인가" 라 층이 다르다. 머리가 넓어지면서
 * #598 의 줄바꿈 장치가 목적을 잃어 함께 걷혔다 (`FacilityRowHeader` 머리주석).
 *
 * **내용(`FacilityRowContent`)과 액션(`CallButton` · `DirectionsButton` · `DirectionsLink`)이
 * 갈려 있다.** 지도 패널은 내용만 선택 버튼으로 감싸고 액션은 그 **형제**로 둔다 —
 * `<a>` 를 `<button>` 안에 넣을 수 없다. 내용을 복제하면 두 목록의 행이 갈리므로
 * 여기서 공유한다. **그 내용이 다시 머리와 본문으로 갈렸다** (#603): 목록 행은 둘 사이에
 * 버튼 층을 끼워야 하고 지도 패널은 둘을 붙여 세워야 해서, 조립은 각자가 한다.
 *
 * **구분선을 스스로 긋지 않는다** (3층 표면, #460). 2a 의 `Row` 는 `border-bottom` 을
 * 행에 걸고 마지막 행이 `last` 로 껐는데, 그러면 행 수를 아는 호출자만 목록을 그릴 수 있다.
 * 선은 `SurfaceList` 가 항목 **사이에만** 긋는다 (#439 가 정한 L2 규약).
 *
 * **`'use client'` 은 남긴다.** #598 에서 `전체 시간표` 펼치기를 걷으면서 이 파일의 훅이
 * 사라졌지만(이제 링크와 버튼 마크업뿐이다), 소비처가 전부 client 컴포넌트라 떼든 남기든
 * 런타임이 같다 — **경계 표시로** 남긴다.
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
  now = new Date(),
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  inset?: Inset
  /**
   * 오늘 한 줄의 기준 시각 — **테스트에서 시각을 고정하기 위한 이음새다** (#654).
   *
   * 기본값이 `new Date()` 라 소비처는 아무것도 넘기지 않는다. 화면이 열린 채 자정을
   * 넘겨도 이 줄은 갱신되지 않는데, 그때는 서버 `openNow` 도 같이 낡아 있고 요약은
   * 그 값과 어긋나는 순간 원문으로 떨어진다 (`summarizeTodayHours`).
   */
  now?: Date
}) {
  return (
    <li className={INSET_CLASS[inset]}>
      <div className="flex flex-col gap-1.5 py-3">
        {/* 머리는 전폭이다 — 버튼 칸이 제목 줄을 먹지 않는다 (#603) */}
        <FacilityRowHeader facility={facility} />

        {/*
          아래 층만 좌우로 갈린다. **`items-center` 다** — 버튼 둘(40px)을 세 줄 안팎의
          글자 덩어리 한가운데 두는 쪽이, 위에 붙여 아래를 비우는 것보다 덩어리로 읽힌다.

          **전화 옆에 길찾기가 붙는다** (#537). 둘은 이 행에서 할 수 있는 두 가지 행동이고
          같은 무게라 나란히 둔다. `gap-2`(8)는 두 버튼이 오조작 없이 갈리는 최소값이다 —
          375 에서 글자 칸에 343 − 40 − 40 − 12 − 8 = 243px 이 남는다 (예전 219px).
        */}
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <FacilityRowBody facility={facility} showDistance={showDistance} now={now} />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <CallButton name={facility.name} tel={facility.tel} />
            <DirectionsButton facility={facility} />
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * 행이 보여주는 사실 — 이름 · 유형 · 영업 상태 · 진료시간 · 거리 · 주소.
 *
 * **머리와 본문을 붙여 세운 것이다** (#603). 지도 패널은 둘 사이에 끼울 것이 없어 이대로
 * 쓰고, 목록 행은 버튼 층을 끼워야 해서 `FacilityRowHeader` · `FacilityRowBody` 를 각각
 * 부른다 — 조립이 갈려도 **머리와 본문의 내용은 한 벌**이다.
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
  now = new Date(),
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  /** 오늘 한 줄의 기준 시각 — `FacilityRow` 와 같은 이음새다 (#654) */
  now?: Date
}) {
  return (
    <>
      <FacilityRowHeader facility={facility} />
      <FacilityRowBody facility={facility} showDistance={showDistance} now={now} />
    </>
  )
}

/**
 * 머리 한 줄 — **`이름 [유형] [24시간] [상태]` 가 전부 왼쪽에 선다** (#603).
 *
 * ── 상태 배지를 오른쪽 끝에서 데려왔다
 *
 * #598 은 이 줄을 `이름 [유형] ···(공백)··· [상태]` 로 두 기둥으로 갈랐다 — 근거는
 * *"목록을 훑을 때 눈이 왼쪽(무엇)과 오른쪽(지금 여는가)만 보면 된다"* 였다. 그 전제는
 * **제목 줄이 219px 밖에 안 될 때**의 것이다: 좁은 줄에서 두 덩어리를 갈라 두려면 공백을
 * 밀어 넣는 수밖에 없었다. 머리가 전폭 343px 을 쓰는 지금은 이름과 배지 셋이 한 덩어리로
 * 다 들어가, 공백을 밀어 넣으면 **상태 배지만 본문 열 바깥에 혼자 떠 있게 된다.**
 * 배지들을 이름에 붙이면 "무엇이고 지금 어떤가" 가 한 번에 읽힌다.
 *
 * ── **세 요소의 높이를 맞춘다**
 *
 * 이름은 `text-title-2`(18/26)이고 `Badge` 의 `md` 는 `text-caption`(12/18) + `py-1` 이라
 * 정확히 26px 이다 — 유형 배지가 쓰던 `sm`(`h-5`, 20px)만 혼자 낮았다. `md` 로 올려 셋을
 * 같은 26px 에 세운다. `md` 는 아트보드가 쓰는 유일한 배지 값이기도 하다(`badge.tsx`).
 * 유형·상태 배지가 나란히 설 때 크기를 맞추는 것은 `place-row.tsx` 가 이미 쓰는 규칙이다.
 *
 * ── **`items-center` 로 되돌린다** — #598 이 `items-start` 를 요구하던 조건이 사라졌다
 *
 * 그때 `items-start` 였던 이유는 *"이름이 두 줄로 감길 때 배지가 가운데로 내려가 첫 줄과
 * 어긋난다"* 였다. 그 일은 배지 묶음이 `shrink-0` 으로 **같은 줄에 붙박여** 이름만 줄어들
 * 때 생긴다. 지금은 배지가 `flex-wrap` 으로 **아랫줄로 비켜난다**: 이름의 max-content 와
 * 배지가 한 줄에 못 들어가면 flex 가 줄을 나누므로, 배지와 같은 줄에 선 이름은 **언제나
 * 한 줄**이다. 한 줄짜리 이름에 맞추는 정렬이라 `items-center` 가 정확하다.
 *
 * ── 긴 이름
 *
 * `min-w-0` + `break-keep` + `break-words` 로 **어절 단위로 감고, 한 어절이 줄 전체보다
 * 길 때만 끊는다** (DESIGN.md §3-3). 전폭이 343px 이라 #598 이 잡았던 어절 중간 끊김
 * (`제주축산업협` / `동조합`)은 그 한 어절이 343px 을 넘지 않는 한 일어나지 않는다 —
 * `basis-[min-content]` 를 따로 두지 않아도 되는 이유다.
 *
 * `w-full` 은 지도 패널 때문이다 — 거기서는 이 줄이 `items-start` 인 세로 flex 안이라
 * 그냥 두면 내용 너비로 오그라든다.
 */
function FacilityRowHeader({ facility }: { facility: NearbyFacilityItem }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-title-2 text-fg min-w-0 font-semibold break-words break-keep">
        {facility.name}
      </span>

      {/* 유형은 병원이 기본이라 약국일 때만 붙인다 — 모든 행에 붙으면 신호가 죽는다 */}
      {facility.facilityType.code === 'ANIMAL_PHARMACY' && (
        <Badge tone="neutral" className="shrink-0">
          {facility.facilityType.name}
        </Badge>
      )}

      {/* `24시간` 은 상태 옆이다 — 유형과 달리 "지금 갈 수 있는가" 쪽 사실이다 */}
      {facility.open24 && (
        <Badge tone="neutral" className="shrink-0">
          {messages.emergency.open24}
        </Badge>
      )}

      <OpenStatus openNow={facility.openNow} />
    </div>
  )
}

/**
 * 머리 아래 사실 — 진료시간 · 휴무 · 거리 · 주소 · 번호 없음 안내.
 *
 * 목록 행에서는 이것이 버튼과 좌우로 갈리는 층의 **왼쪽**이고, 지도 패널에서는 머리 바로
 * 아래다 (`FacilityRow` · `FacilityRowContent`).
 */
function FacilityRowBody({
  facility,
  showDistance,
  now,
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  now: Date
}) {
  /*
    **주소를 자르지 않는다** (#598). 예전에는 `shortAddress()` 로 `제주시` 까지만 보여
    같은 시·군의 두 병원이 메타 줄에서 구별되지 않았다 — 이 화면에서 주소는 "어디쯤인지"
    가 아니라 **찾아갈 곳**이라, 다른 목록(`/places`)과 달리 전체가 정보다. 그쪽은 축약을
    계속 쓴다 (`lib/place/address.ts` 는 이 화면을 잃어도 사용처가 넷 남는다).
  */
  const meta = [
    showDistance ? formatDistance(facility.distanceMeters) : null,
    facility.addr,
  ].filter((part): part is string => part !== null && part !== '')

  return (
    <>
      <FacilityHours facility={facility} now={now} />

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
 * 운영시간 — **세 갈래뿐이다** (#654 E-4).
 *
 * | 조건 | 그리는 것 |
 * | --- | --- |
 * | `operatingHoursKnown === false` 또는 원문 `null` | `진료시간이 등록돼 있지 않아요` |
 * | `summarizeTodayHours()` 가 `null` | **원문 그대로** (`line-clamp-2`) — 가드 폴백. `openNow` 가 있으면 어긋남 한 줄 (#671 C-5) |
 * | 요약이 섰다 | **오늘 한 줄만.** 원문도 손잡이도 없다 |
 * | 요약이 `24시간` 갈래 | **아무것도 그리지 않는다** — `[24시간]` 배지가 이미 말한다 |
 *
 * ── 파싱을 다시 연 근거 (#537 · #598 이 두 번 기각한 자리다)
 *
 * 기각 근거는 dev 실측 서식의 불규칙함이었다:
 *
 *     월~화, 목~금,토 09:30~20:00, 일 09:30~14:00   ← 요일 목록 + 범위, 공백 불규칙, 수요일 없음
 *     월~금 09:00~21:00, 토 09:00~21:00, 법정공휴일 09:00~21:00   ← 일요일 항목 자체가 없음
 *
 * *"수요일에 첫 줄을 잘못 읽으면 닫힌 병원으로 달려가게 된다"* — 이 화면에서 가장 비싼
 * 실패다. 그 규칙이 지키려던 것은 **"틀린 시간을 말하지 않는다"** 이고,
 * `lib/emergency/operating-hours.ts` 는 그것을 금지가 아니라 **불변식**으로 세운다:
 * 상태는 서버 `openNow` 만 근거로 삼고 · 조각 하나라도 못 읽으면 침묵하고 · 원문에서
 * 읽은 개폐가 서버와 어긋나면 읽기를 버린다. **위 두 문자열은 그 검증을 통과하지
 * 못하거나(수요일 없음 + 서버가 진료중) 통과한 채로만 요약된다.**
 *
 * **둘째 갈래(원문 폴백)가 그 불변식의 몸통이다.** 요약을 못 세웠을 때 침묵하는 자리라
 * 지운 적이 없고 지우지 않는다 — 셋째 갈래에서 원문을 안 그리는 것은 "감춘다" 가 아니라
 * **이미 다 말했다**는 뜻이다.
 *
 * ── **접기를 두지 않는다** (#654 리뷰에서 뒤집은 것)
 *
 * 한때 오늘 한 줄을 `<summary>` 로 만들고 원문을 `<details>` 안에 뒀다. 근거는 *"요약이
 * 틀렸을 때 확인할 곳이 있어야 한다"* 였는데, **접을 것이 원문 한 필드뿐이라 성립하지
 * 않는다**: 오늘 한 줄은 그 한 필드를 읽어 만든 것이고, 요약이 선 순간 원문에는 오늘에
 * 대해 더 말할 것이 남아 있지 않다. 못 읽었을 때는 애초에 둘째 갈래로 떨어져 원문이
 * 통째로 서 있다. 그래서 펼치기는 **같은 데이터를 두 번 보여주는 손잡이**였다 —
 * 접기 전과 후의 정보량이 같으면 그것은 접기가 아니다.
 *
 * 걷으면서 **목록 행과 지도 패널의 렌더가 같아졌다.** `<summary>` 를 선택 `<button>` 안에
 * 넣을 수 없어 갈라 뒀던 분기(`collapsible`)가 통째로 사라졌다.
 *
 * **"지금 여는가" 는 이 줄이 아니라 머리의 `OpenStatus` 배지가 답한다** — 서버가 계산한
 * `openNow` 다. 이 줄은 **시각**만 맡는다 (감사 문구 `진료중 · 24:00까지` 의 앞 절을
 * 배지에 넘긴 것이다).
 */
function FacilityHours({ facility, now }: { facility: NearbyFacilityItem; now: Date }) {
  // 없으면 없다고 말한다 — "닫힘" 과 구분된다
  if (!facility.operatingHoursKnown || facility.operatingHours === null) {
    return <p className="text-body-2 text-fg-muted break-keep">{messages.emergency.hoursUnknown}</p>
  }

  /*
    ── **휴무는 오늘 한 줄 밖이다** (#598 에서 정한 것을 그대로 지킨다)

    #537 은 휴무를 운영시간과 **같은 줄에 이어 붙였다** — *"따로 줄을 만들면 접어서 번 한
    줄을 도로 내놓는다"*. #598 이 그것을 뒤집었다: 375 실측에서 운영시간 117줄 중
    **75줄(64%)이 두 줄에서 잘렸고, 잘린 75줄은 전부 휴무 절을 달고 있었다.**

    오늘 한 줄이 되어도 휴무는 제 줄에 남는다. `매주 수요일 휴무` 는 **오늘의 사실이
    아니라 다음 방문의 사실**이라 오늘 줄에 섞을 수 없고, 짧아서 잘리지도 않는다.
  */
  const rest =
    facility.restDate === null ? null : `${facility.restDate} ${messages.emergency.restPrefix}`

  const today = summarizeTodayHours(facility, now)
  /*
    **`null` 이 두 곳에서 오고 뜻이 다르다.**

    `today === null` 은 *"읽지 못했다"* — 원문을 그대로 그린다.
    `label === null` 은 *"읽었는데 새로 말할 것이 없다"* — `24시간` 갈래이고, 머리
    배지가 이미 말하고 있어 **아무것도 그리지 않는다** (`todayHoursLabel` 머리주석).
  */
  const label = today === null ? null : todayHoursLabel(today)

  return (
    <>
      {today === null ? (
        /*
          읽지 못했거나 서버 `openNow` 와 어긋났다 — **#598 의 렌더 그대로다.** 원문 길이는
          시설마다 제각각이라(`법정공휴일` 항목까지 붙는 곳이 있다) 상한이 없으면 한 행이
          목록의 리듬을 혼자 깬다.
        */
        <>
          <p className="text-body-2 text-fg line-clamp-2 tabular-nums">{facility.operatingHours}</p>

          {/*
            **배지와 원문이 어긋날 수 있다는 것을 그 행에서 말한다** (#671 C-5).

            이 갈래가 서는 조건 자체가 *"원문에서 읽은 개폐가 서버 `openNow` 와 맞지
            않거나 아예 읽히지 않았다"* 라, **서는 행마다 보기에 자기모순**이다 —
            `[영업 종료]` 아래 `월~금 09:00~22:00`(수요일 09:52 실측 = 진료 시간 안).
            dev 실물 135곳 중 15곳이 여기로 떨어진다.

            페이지 바닥 `source` 가 전역으로 덮지만 그것은 모든 행에 같은 말이라 **이
            15행이 왜 다른지**는 말하지 못한다. 원문을 걷는 것은 답이 아니다 — 원문을
            그대로 보이는 것이 불변식의 몸통이다 (머리주석). 그래서 **한 줄을 더한다.**

            **`openNow === null` 에는 달지 않는다.** 그 행의 배지는 점선 `확인 필요` 라
            어긋날 **주장이 없고**, 배지가 이미 "모른다" 를 말하고 있다 — 거기에 "서로
            달라 보일 수 있어요" 를 붙이면 없는 모순을 만들어 낸다.
          */}
          {facility.openNow !== null && (
            <p className="text-caption text-fg-muted break-keep">
              {messages.emergency.hoursRawMismatch}
            </p>
          )}
        </>
      ) : (
        /*
          **원문을 함께 그리지 않는다.** 이 한 줄이 그 원문을 읽어 만든 것이고, 오늘에
          대해 원문이 더 말할 것은 없다 — 나란히 두면 같은 사실이 두 번 선다.
        */
        label !== null && <p className="text-body-2 text-fg font-semibold tabular-nums">{label}</p>
      )}

      {rest !== null && <p className="text-body-2 text-fg-muted break-keep tabular-nums">{rest}</p>}
    </>
  )
}

/**
 * 영업 상태 3상태 — `openNow` 가 근거다.
 *
 * ── **색으로 가른다** (#598) — 예전 규칙을 뒤집은 것이다
 *
 * 이 자리는 *"진료중은 채운 태그, 영업 종료는 흐리게 — 색이 아니라 무게로 가른다"* 였다
 * (아트보드 주석: 초록·주황은 산책 위험도 전용이고 영업 여부는 판정이 아니다).
 * **뒤집은 근거는 배지가 머리 줄에서 `24시간` 과 나란히 서게 된 것이다.** 자기 줄에 혼자
 * 있을 때는 무게 차이만으로도 읽혔지만, 회색 배지 둘이 이름 옆에 붙고 나면 **어느 쪽이
 * 상태인지가 모양으로 구별되지 않는다.** 급할 때 훑는 화면이라 색이 여기서는 장식이
 * 아니라 축이다. **#603 이 배지들을 오른쪽 끝에서 이름 옆으로 데려오면서 이 근거는 더
 * 세졌다** — 셋이 한 덩어리로 붙어 있어 색 말고는 가를 것이 없다.
 *
 * ── **자기 톤을 쓴다** — 등급 토큰도 장애 토큰도 빌리지 않는다
 *
 * 처음에는 값이 같다는 이유로 `brand`(= `metric-high`) · `danger` 를 그대로 썼는데,
 * 리뷰에서 둘 다 걸렸다. `metric-high` 초록은 홈의 `여행 적합` 배지와 **픽셀 단위로
 * 같아** 같은 색이 한쪽에서는 3단계 척도의 한 칸, 다른 쪽에서는 두 값 중 하나가 된다.
 * `--danger-*` 는 DESIGN.md §2-6 이 **5xx 일시 장애 전용**으로 못박은 것인데, 문 닫은
 * 병원은 장애가 아니고 목록의 **72%(135행 중 97행)** 가 그 배지를 단다.
 *
 * 그래서 `status-open` · `status-closed` 톤을 냈다 (DESIGN.md §2-9). 값은 각각 그 둘과
 * 같지만 이름을 분리한다 — `--link` 가 `--metric-high-500` 과 값이 같아도 이름을 지키는
 * 것과 같은 규칙이고, 나중에 갈라야 할 때 한 줄만 고치면 된다.
 *
 * **색은 유일한 채널이 아니다.** 두 tint 의 명도 대비가 1.02:1 이라 적록색약에게는 밝기가
 * 같다 — `진료중` 은 `strong` 으로 무게를 함께 올린다. 예전 규칙("색이 아니라 무게로
 * 가른다")을 버린 것이 아니라 **그 위에 색을 얹은 것**이다.
 *
 * ── `null` 은 색을 받지 않는다
 *
 * `null` 은 "닫힘" 이 아니라 **판정할 수 없음**이다. 여기에 세 번째 색을 주면 초록·빨강의
 * 대비가 묽어지고, "확인 필요" 가 "주의" 로 읽힌다. 점선 중립을 그대로 둔다 —
 * `operatingHoursKnown: false` 처럼 원문조차 없는 곳이 있어 "모름" 자체가 정보다.
 *
 * **장소 상세의 `PlaceOpenStatus` 와 합치지 않았다** (#294). 문구가 다르고(`진료중` vs
 * `영업 중`) `null` 처리가 갈린다 — 그쪽은 운영시간 원문이 항상 함께 와 "모름" 이 정보가
 * 아니다. **이제 색 규칙도 갈렸다**: 그 화면의 배지는 카드 안에서 자기 줄을 갖고 있어
 * 위 근거가 적용되지 않는다. 규칙을 또 바꿀 때는 양쪽을 같이 본다.
 */
function OpenStatus({ openNow }: { openNow: boolean | null }) {
  if (openNow === null) {
    return (
      <span className="text-caption text-fg-muted border-border-strong inline-flex shrink-0 items-center rounded-sm border border-dashed px-2 py-1 font-semibold">
        {messages.emergency.statusUnknown}
      </span>
    )
  }

  /*
    **무게를 `className` 으로 덮지 않는다.** `component-guide.md` §3 이 `font-*` 를 금지
    열에 두고 있어 `Badge` 의 `strong` prop 으로 연다.

    **진료중만 무게를 올린다.** 색이 유일한 채널이면 안 되기 때문이다 — 두 tint 의 명도
    대비가 1.02:1 이라 적록색약에게는 밝기가 같다. 예전 규칙("색이 아니라 무게로 가른다")이
    사라진 것이 아니라, **무게 위에 색이 얹힌 것**이다.
  */
  return (
    <Badge tone={openNow ? 'status-open' : 'status-closed'} strong={openNow} className="shrink-0">
      {openNow ? messages.emergency.statusOpen : messages.emergency.statusClosed}
    </Badge>
  )
}

/**
 * 40px 전화 버튼.
 *
 * **번호가 없어도 자리를 비우지 않는다.** 자리가 사라지면 "이 병원만 뭔가 다르다" 가
 * 아니라 "화면이 깨졌다" 로 읽힌다 (아트보드 주석).
 *
 * **52px 에서 40px 로 줄였다** (#603). 버튼이 제목 줄과 같은 층에 있을 때는 행 높이를
 * 버튼이 정해 52px 이 기준 노릇을 했는데, 아래 층으로 내려오면서 행 높이는 글자 덩어리가
 * 정하고 버튼은 그 안에 든다. **DESIGN.md §"모바일 최소 터치 영역 44×44" 를 밑도는 값**을
 * 의도적으로 고른 자리다 — 지도 패널의 `DirectionsLink`(전폭 44px)가 같은 행동의 큰
 * 과녁을 계속 들고 있고, 목록 행은 40px 두 개를 8px 떼어 오조작 쪽을 막는다.
 */
export function CallButton({ name, tel }: { name: string; tel: string | null }) {
  const base =
    'flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors'

  if (tel === null) {
    return (
      <span aria-hidden className={cn(base, 'border-border text-fg-subtle')}>
        <PhoneIcon size={20} />
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
      <PhoneIcon size={20} />
    </a>
  )
}

/**
 * 40px 길찾기 버튼 — **목록 행의 전화 옆** (#537).
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
    'flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors'

  if (href === null) {
    return (
      <span aria-hidden className={cn(base, 'border-border text-fg-subtle')}>
        <DirectionsIcon size={20} />
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
      <DirectionsIcon size={20} />
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
