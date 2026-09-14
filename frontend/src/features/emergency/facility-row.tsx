'use client'

import { Badge } from '@/components/badge'
import { DirectionsIcon, PhoneIcon } from '@/components/icons'
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
 * **진료시간은 서버 문자열 그대로 렌더한다.** `"월~금 09:00~19:00, 토 09:00~13:00"` 을
 * 파싱해 "오늘 19:00까지" 로 요약하지 않는다 — 서식이 조금만 달라도 틀린 시간을 말하게 된다.
 * **#537 이 "오늘 기준 한 줄" 을, #598 이 "두 줄로 날짜·시간" 을 요구했을 때도 이 규칙은
 * 그대로다** — 바꾼 것은 판정이 아니라 **몇 줄까지 흘리는가**뿐이다 (`FacilityHours`).
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
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  inset?: Inset
}) {
  return (
    <li className={INSET_CLASS[inset]}>
      <div className="flex items-center gap-3 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FacilityRowContent facility={facility} showDistance={showDistance} />
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
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
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
      {/*
        **1행 = `이름 [유형] ···(공백)··· [상태]`** (#598). 상태가 이름 아래 자기 줄을
        쓰던 것을 첫 줄 오른쪽 끝으로 올린다 — 목록을 훑을 때 눈이 왼쪽(무엇)과
        오른쪽(지금 여는가) 두 기둥만 보면 된다.

        ── **이름이 길면 상태가 아랫줄로 내려간다** (`flex-wrap` + `basis-[min-content]`)

        오른쪽 묶음은 `shrink-0` 이라 좁은 칸에서 줄어드는 쪽은 이름뿐인데, 375 에서 첫 줄
        가용 폭이 219px 이고 `영업 여부 확인 필요` 하나가 110px 을 가져간다 — 남는 109px 은
        `제주축산업협동조합`(한 어절 145px) 같은 이름을 어절째로 담지 못한다. 그대로 두면
        `break-words` 가 **어절 한가운데를 끊어**(`제주축산업협` / `동조합`) DESIGN.md §3-3
        (한국어는 어절 단위로 감는다)을 뒤집는다.

        그래서 왼쪽 묶음의 **기준 크기를 `min-content`(= 가장 긴 어절)로** 준다. 둘이 한
        줄에 서지 못하면 flex 가 줄을 바꾸므로, **이름이 짧으면 한 줄, 길면 이름이 줄 전체를
        쓰고 상태가 아랫줄 오른쪽에 선다.** 판단이 CSS 안에서 스스로 갈려 브레이크포인트를
        두지 않아도 된다.

        `flex-1`(= `flex: 1 1 0%`)이 아니라 `grow` 인 것이 핵심이다 — `flex-1` 은 기준
        크기를 0 으로 덮어 **언제나 한 줄**로 만든다.

        `break-words` 는 그래도 남긴다. 줄 전체(219px)로도 담기지 않는 한 어절
        (`제주특별자치도동물의료원부속24시응급진료센터`)이 실제로 있고, 그때는 끊는 것이
        가려지는 것보다 낫다 — `break-keep` 이 함께 있어 **어절로 감을 수 있으면 먼저 감는다.**

        `24시간` 은 상태 옆에 붙인다 — 유형과 달리 "지금 갈 수 있는가" 쪽 사실이다.
      */}
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <div className="flex min-w-0 grow basis-[min-content] flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-title-2 text-fg min-w-0 font-semibold break-words break-keep">
            {facility.name}
          </span>
          {/* 유형은 병원이 기본이라 약국일 때만 붙인다 — 모든 행에 붙으면 신호가 죽는다 */}
          {facility.facilityType.code === 'ANIMAL_PHARMACY' && (
            <Badge tone="neutral" size="sm" className="shrink-0">
              {facility.facilityType.name}
            </Badge>
          )}
        </div>

        {/* `ml-auto` — 아랫줄로 내려갔을 때도 오른쪽 기둥에 남는다 */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {facility.open24 && <Badge tone="neutral">{messages.emergency.open24}</Badge>}
          <OpenStatus openNow={facility.openNow} />
        </div>
      </div>

      <FacilityHours facility={facility} />

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
 * 운영시간 — **원문을 그대로 두고 두 줄까지 흘린다** (#537 → #598).
 *
 * ── 파싱하지 않는 이유 (#598 이 "두 줄로 날짜·시간" 을 요구했을 때 다시 확인한 것)
 *
 * 요일과 시각을 갈라 각각 한 줄에 두는 안은 원문을 파싱해야 하는데, 그것은 **두 번
 * 기각된 안**이다 — 정본은 `types/emergency.ts` 의 `operatingHours` 주석이다. dev 실측이
 * 그 근거를 그대로 보여준다:
 *
 *     월~화, 목~금,토 09:30~20:00, 일 09:30~14:00   ← 요일 목록 + 범위, 공백 불규칙, 수요일 없음
 *     월~금 09:00~21:00, 토 09:00~21:00, 법정공휴일 09:00~21:00   ← 일요일 항목 자체가 없음
 *
 * 수요일에 첫 줄을 잘못 읽으면 **닫힌 병원으로 달려가게 된다.** 이 화면에서 가장 비싼
 * 실패라, 얻는 것(정렬된 두 줄)보다 잃는 것이 크다.
 *
 * **쉼표로 끊긴 조각 하나하나가 이미 `요일 + 시각` 이다.** 원문을 두 줄까지 흘리는 것으로
 * 요구를 충족하면서 파싱 금지도 지킨다.
 *
 * ── 접기를 걷었다 (#598)
 *
 * #537 이 `전체 시간표` 펼치기 버튼을 둔 것은 **한 줄**(`line-clamp-1`)로 접은 나머지에
 * 손이 닿게 하려는 것이었다. 두 줄이면 dev 실측 문자열이 대부분 끝까지 보여 버튼이
 * 눌러도 아무 일이 없는 자리가 된다 — 그리고 그 버튼은 44px 터치 영역을 들고 있어
 * **행마다 한 줄을 더 먹었다.** 접기를 걷는 쪽이 두 줄을 내주고도 행이 짧아진다.
 *
 * 걷으면서 **행에서 유일한 상태가 사라졌다** — 이 파일은 이제 훅을 쓰지 않는다.
 *
 * **"지금 여는가" 는 이 줄이 아니라 위의 `OpenStatus` 배지가 답한다** — 서버가 계산한
 * `openNow` 다. 이 줄은 그 근거를 확인하는 자리다.
 */
function FacilityHours({ facility }: { facility: NearbyFacilityItem }) {
  // 없으면 없다고 말한다 — "닫힘" 과 구분된다
  if (!facility.operatingHoursKnown || facility.operatingHours === null) {
    return <p className="text-body-2 text-fg-muted break-keep">{messages.emergency.hoursUnknown}</p>
  }

  /*
    **`line-clamp-2` 다.** 넘치는 것을 그대로 흘리지 않는 이유는 #537 과 같다 — 원문
    길이는 시설마다 제각각이라(`법정공휴일` 항목까지 붙는 곳이 있다) 상한이 없으면 한
    행이 목록의 리듬을 혼자 깬다. 지도 패널도 같은 경로를 탄다.

    ── **휴무는 그 상한 밖이다** (#598 리뷰에서 뒤집은 것)

    #537 은 휴무를 **같은 줄에 이어 붙였다** — *"따로 줄을 만들면 접어서 번 한 줄을 도로
    내놓는다"*. 그때는 `전체 시간표` 버튼이 있어 잘린 뒤도 펼쳐 볼 수 있었다. **이 PR 이
    그 버튼을 걷으면서 전제가 사라졌다**: 375 실측에서 운영시간 117줄 중 **75줄(64%)이
    두 줄에서 잘리고, 잘린 75줄은 전부 휴무 절을 달고 있었다.** 시설 상세 라우트도 없어
    (#148) `매주 수요일 휴무` 를 되찾을 길이 아무 데도 없었다.

    휴무를 자기 줄로 뺀다. 한 줄을 내주지만 **이 화면에서 가장 비싼 실패("닫힌 병원으로
    달려가기")를 막는 정보**이고, 짧아서 잘리지 않는다. 운영시간 원문은 그대로 두 줄이다.
  */
  const rest =
    facility.restDate === null ? null : `${facility.restDate} ${messages.emergency.restPrefix}`

  return (
    <>
      <p className="text-body-2 text-fg line-clamp-2 tabular-nums">{facility.operatingHours}</p>
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
 * **뒤집은 근거는 배지가 1행 오른쪽 끝으로 올라간 것이다.** 자기 줄에 혼자 있을 때는
 * 무게 차이만으로도 읽혔지만, 이름 옆 끝자리에서 `24시간` 과 나란히 서고 나면 회색 배지
 * 둘이 붙어 **어느 쪽이 상태인지가 모양으로 구별되지 않는다.** 급할 때 훑는 화면이라
 * 색이 여기서는 장식이 아니라 축이다.
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
      <span className="text-caption text-fg-muted border-border-strong inline-flex items-center rounded-sm border border-dashed px-2 py-1 font-semibold">
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
    <Badge tone={openNow ? 'status-open' : 'status-closed'} strong={openNow}>
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
