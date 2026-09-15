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
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  inset?: Inset
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
            <FacilityRowBody facility={facility} showDistance={showDistance} />
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
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
}) {
  return (
    <>
      <FacilityRowHeader facility={facility} />
      <FacilityRowBody facility={facility} showDistance={showDistance} />
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
 * **"지금 여는가" 는 이 줄이 아니라 머리의 `OpenStatus` 배지가 답한다** — 서버가 계산한
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
