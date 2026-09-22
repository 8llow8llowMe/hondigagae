import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { CheckIcon, ImageIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { formatCelsius } from '@/lib/format/celsius'
import { formatDistance } from '@/lib/format/distance'
import { isLongTrip } from '@/lib/geo/distance'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { placeMetaLine } from '@/lib/place/meta'
import { isPlaceTarget, type PlanItemRowModel } from '@/lib/plan/detail'
import { planItemIllustration } from '@/lib/plan/illustration'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import { formatStartTime } from '@/lib/plan/start-time'
import { walkCourseMetaLine } from '@/lib/plan/walk-course-meta'
import { itemWalkSafetyView } from '@/lib/plan/walk-safety'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlanItemWalkSafetyItem } from '@/types/plan'

/**
 * 방문 체크에 필요한 것 한 묶음 — 이슈 #124.
 *
 * **optional 이다.** 넘기지 않으면 토글이 아예 렌더되지 않는다 — 기간 밖 고아 항목
 * 섹션(`PlanOutOfRangeSection`)이 그 경로다. 어느 일자의 흐름에도 속하지 않는 항목에
 * '다녀옴' 을 두면 무엇을 다녀왔다는 것인지 말할 수 없다.
 */
export type PlanItemVisit = {
  /** 저장 중. **그 행만** 잠긴다 — 방문 체크는 항목 한 행만 바꿔 서로 충돌하지 않는다 */
  pending: boolean
  /** **이 항목에서** 난 실패만 온다. 좁히지 않으면 안 누른 행에도 오류가 남는다 */
  error: PlanDaySaveError | null
  /** 다음 상태를 넘긴다 — 해제도 같은 API 다 (`visited: false`) */
  onToggle: (visited: boolean) => void
  /**
   * 아직 떠나지 않은 여행이다 (#732 · 진단 665-7). **`다녀옴 표시` 글자를 접는다** —
   * 그 화면에서 가장 많이 반복되는 문자열인데, 아무도 다녀오지 않은 일정에서 모든 항목에
   * 붙어 있었다. 판정은 화면이 하고(`planPhaseOf`) 행은 결과만 받는다.
   *
   * **체크된 행은 낱말을 지킨다** — `다녀옴` 은 상태를 말하는 유일한 낱말이라 접으면
   * 색과 아이콘만 남는다 (DESIGN.md §7). 접는 것은 반복되는 쪽(`다녀옴 표시`)뿐이다.
   */
  compact: boolean
}

/**
 * 일정 항목 행 — 아트보드 `혼디가개 여행 일정.dc.html` 01·02.
 *
 * **2열이다** (썸네일 · 텍스트). 순번 원 + 썸네일 + 텍스트로 3열을 만들면 390 에서
 * 제목이 눌린다 — **순번은 썸네일 좌상단 칩**으로 얹는다 (아트보드 01 주석).
 *
 * **주소 · 이미지 · 좌표는 항목이 직접 들고 온다** (`item.place`, #86·#115). 예전에는
 * 항목당 `GET /places/{placeId}` 보강으로 따라왔다. **`place` 는 통째로 `null` 일 수
 * 있다** — `WALK`·`MOVE` 처럼 장소가 아닌 항목, 원천에서 사라진 장소, tour-service
 * 장애 셋 다 `null` 이다. 그때도 **행을 지우지 않고 제목만 남긴다.** 일정 자료는 우리
 * DB 이고 장소는 다른 서비스다 (공통명세 S8).
 *
 * **메타 줄은 `주소 · 실내` 다** (명세 D2). `indoor` 는 #16 으로 장소 응답에 들어왔고
 * #86 이 항목 요약에도 실어 준다 (#112). **`null` 이면 낱말이 빠진다** — 여기에는 실내
 * 필터가 없어 "실내 여부 미확인" 배지를 둘 자리가 없다. 배지 없이 단정만 피한다
 * (`lib/place/indoor.ts`).
 *
 * **`WALK` 항목은 다른 메타 줄을 쓴다** (#620 · 일정상세-세부명세 D12-4). `item.place` 가
 * 항상 `null` 이라 `walkCourseMetaLine(item.walkCourse)` 가 대신 `{구간명} · {거리}km ·
 * {소요시간}` 을 만든다. **요약이 오지 않아도(`walkCourse: null`) 오류로 말하지 않는다**
 * — 줄 자체가 없을 뿐 행은 제목으로 살아남는다 (D12-4-1).
 *
 * **`startTime` 을 제목 위 캡션 한 줄로 표시한다** (#623 · 명세 D14).
 *
 * **D8-9 를 뒤집는다.** 예전에는 아트보드 헤더 주석 "시간 없음" 을 근거로 표시하지
 * 않았다. 그 주석은 **아트보드가 그린 예시 일정에 값이 없었다는 사실**을 적은 것이지
 * 화면에 그리지 말라는 지시가 아니다 — `혼잡도 정보 없음`(D8-7)도 같은 문장이었고
 * 그쪽은 나중에 BE 미착수로 밝혀졌다. 이제 [#625](https://github.com/8llow8llowMe/hondigagae/issues/625)
 * 의 항목 산책 위험도가 `startTime` 없는 항목을 판정 거부하므로, 시각이 화면에 없으면
 * 그 판정 자체가 성립하지 않는다 (아트보드 이후에 생긴 요구).
 *
 * **없으면 줄 자체를 그리지 않는다.** 형식이 어긋난 값도 지어내지 않고 숨긴다 —
 * 정규화는 `lib/plan/start-time.ts` 의 `formatStartTime()` 하나가 전담한다.
 *
 * **[#625](https://github.com/8llow8llowMe/hondigagae/issues/625) 의 산책 위험도 배지가 이 시각 줄에 붙는다** (명세 D15-5).
 * `walkSafety` 가 `undefined` 면(아직 안 왔다) 배지·문장 없이 시각만 선다 — 없는 판정을
 * 빈 배지로도 말하지 않는다. **배지를 세울지는 서버가 이미 가른 결과
 * (`walkSafetyLevel !== null && code !== 'UNKNOWN'`)를 그대로 따른다** — 이 컴포넌트가
 * 자기 조건을 다시 만들지 않는다 (D15-3). 체감온도는 배지가 서는 정상 판정에서만 함께
 * 낸다(D15-7) — `messages.plan.walkSafetyFeelsLikeLabel`(`체감온도`, 시각 기준)이고
 * `displayTemperature()`(하루 단위 폴백)를 쓰지 않는다.
 *

 * **방문 체크 토글은 링크의 형제다** (#124). 행 전체가 하나의 링크라 그 안에 버튼을 넣을
 * 수 없다 — 중첩 상호작용은 시맨틱이 깨지고 키보드로 어느 쪽이 잡히는지 알 수 없다.
 * 그래서 링크를 `flex-1` 로 두고 토글을 **후행 44px 열**로 뺀다. 아트보드 01 이 금지한
 * 것은 순번 원 + 썸네일 + 텍스트의 **선행** 3열(390 에서 제목이 눌린다)이고, 후행
 * 아이콘 열은 제목이 쓰는 폭을 그만큼만 줄인다.
 */
export function PlanItemRow({
  model,
  visit,
  walkSafety,
  dayPetConditionApplied = false,
}: {
  model: PlanItemRowModel
  /** 없으면 토글이 렌더되지 않는다 — 기간 밖 항목 섹션이 그 경로다 */
  visit?: PlanItemVisit
  /**
   * 이 항목의 산책 위험도 (#625). **`undefined` 는 오류가 아니라 "아직 안 왔다"다** —
   * 조회 중이거나, 응답에 이 `planItemId` 가 없거나(일괄 교체 직후 한 프레임), 전체
   * 조회가 404/400 이라 자리를 통째로 숨긴 경우가 전부 이 모양이다 (D15-6 · D15-7).
   */
  walkSafety?: PlanItemWalkSafetyItem | undefined
  /**
   * 그 **일자** 판정이 반려견 특성을 반영했는가 (#717 · `PlanWeatherResponse`).
   *
   * **이 행이 일자 판정과 어긋나는지 가르는 데만 쓴다** — 행이 이 값을 그리지는 않는다.
   * 기본값은 `false`(=행이 아무 말도 하지 않는다)라 판정을 함께 넘기지 않는 사용처
   * (기간 밖 항목 섹션)는 그대로 굴러간다.
   *
   * **`basisPetName` 은 받지 않는다.** 한 마리 일정이면 이름이 `null` 인데 그때도 일자는
   * "특성을 반영했다" 를 주장하므로, 어긋남의 기준은 **이름 유무가 아니라
   * `petConditionApplied` 자체**다. 이름은 일자 카드의 표시 문제다.
   */
  dayPetConditionApplied?: boolean
}) {
  const { item } = model
  const { place, walkCourse } = item
  // WALK 항목은 place 가 항상 null 이고 PLACE 항목은 walkCourse 가 항상 null 이다 —
  // 둘 중 온 쪽만 자리를 채운다 (`일정상세-세부명세.md` D12-1)
  const thumbnail = imageSrc(place?.firstImage ?? walkCourse?.firstImage ?? null)
  /*
    사진이 없으면 **유형** 일러스트로 채운다 (#842). 회색 타일은 유형까지 모를 때만이다 —
    dev 실측(제주 400건)으로 `firstImage` 가 없는 장소가 70% 라 회색이 예외가 아니라
    기본이었다. `contentType` 이 아니라 `itemType` 인 근거는 `lib/plan/illustration.ts`.
  */
  const illustration = thumbnail === null ? planItemIllustration(item.itemType.code) : null
  const meta =
    placeMetaLine(place?.addr1 ?? null, place?.indoor ?? null) ?? walkCourseMetaLine(walkCourse)
  // 형식이 어긋나면 null 이다 — 에러도 배지도 내지 않고 줄 자체를 그리지 않는다 (D14-3)
  const startTime = formatStartTime(item.startTime)
  // walkSafety 가 없으면 view 도 없다 — 시각 줄에 배지·문장 자리를 만들지 않는다
  const walkSafetyView = walkSafety === undefined ? null : itemWalkSafetyView(walkSafety)
  const feelsLike = formatCelsius(walkSafety?.feelsLikeCelsius ?? null)
  /*
    **일자의 주장과 이 행의 사실이 어긋날 때만 한 줄을 더한다** (#717).

    - 항목 `true`/`null` → 아무 말도 하지 않는다. `null` 은 "묻지 않았다"(판정을 못 낸
      줄)이고, `true` 는 일자 카드가 이미 말한 것과 같은 말이다
    - 일자도 `false` 인 날 → **행은 말하지 않는다.** 그날 판정 자리(`PlanDayVerdict`)가
      이미 "일반 조건으로 판정했다" 를 한 번 말했고, 항목마다 되풀이하면 항목 수만큼
      줄이 늘면서 새 정보는 0 이다 (D15-5 가 노면온도·기온을 행에서 뺀 것과 같은 규율)
    - 일자 `true` + 항목 `false` → **이것만 그린다.** 일자 카드가 말할 수 없는 사실이다

    **어긋남은 실제로 생긴다 — 두 값의 출처가 다르다.** 일자는 auth 특성 조회 결과
    (`anyMatch(isKnown)`)이고 항목은 tour 의 `petCondition().isSpecified()` 다. 기준견의
    조건만 `unknown()` 이면 일자 `true` · 항목 `false` 가 난다.

    **장소 상세 패널(`PlaceWalkSafetyPanel` 의 `BasisLine`)과 모양이 반대인 것이 정상이다.**
    그쪽은 `{name} 기준` 문장을 **자기가 소유**해서 `false` 면 이름을 **빼는 것**(억제)으로
    거짓이 사라진다. 이 행은 그 문장을 소유하지 않고 일자 카드가 말하므로, 행에서 억제해
    봐야 **일자의 주장은 그대로 남는다** — 거짓을 지우려면 행이 한 줄을 **명시적으로 더해야**
    한다. 같은 원칙(화면이 거짓 기준을 주장하지 않는다)을 다른 레이아웃에 적용한 것이다.
  */
  const showPetConditionNote = dayPetConditionApplied && walkSafety?.petConditionApplied === false

  /*
    **`targetId` 가 있다고 링크하지 않는다.** `WALK` 의 `targetId` 는 `walk_course.id`
    라 `/places/{id}` 로 보내면 남의 id 로 404 를 만든다 — 보강 대상과 같은 판정을 쓴다.
  */
  const href = isPlaceTarget(item) ? `/places/${item.targetId as string}` : null

  const body = (
    <>
      <div
        className={cn(
          'bg-band relative size-20 shrink-0 overflow-hidden rounded-md lg:size-24',
          // 다녀온 곳은 남은 곳보다 뒤로 물러난다. **이것만으로 전달하지 않는다** —
          // 배지(`다녀옴`)와 `aria-pressed` 가 같은 사실을 낱말로도 말한다 (DESIGN.md §7)
          item.visited && 'opacity-60',
        )}
      >
        {thumbnail !== null ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="(min-width: 1024px) 96px, 80px"
            className="object-cover"
          />
        ) : illustration !== null ? (
          /*
            **`next/image` 가 아니라 `<img>` 다** — 저장소 안의 정적 SVG 라 최적화할 것이
            없고(`unoptimized: true`) 원격 호스트 허용 목록과도 무관하다. **장식이므로
            `alt=""` 다** — 무엇인지는 제목과 유형 배지가 이미 낱말로 말한다
            (`place-row.tsx` 가 같은 이유로 같은 모양이다).
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={illustration} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="text-fg-subtle absolute inset-0 flex items-center justify-center">
            <ImageIcon size={20} />
          </span>
        )}

        {/* 순번 칩 — 썸네일 좌상단. 자료가 아니라 순서 표시라 a11y 트리에서 뺀다
            (행 순서는 목록 구조가 이미 말한다) */}
        <span
          aria-hidden
          className="bg-fg text-fg-inverse text-caption absolute top-1 left-1 inline-flex size-5 items-center justify-center rounded-sm font-bold tabular-nums"
        >
          {model.item.sequence + 1}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {/*
          제목 위 캡션 한 줄 (D14-3). **제목 줄에 넣지 않는다** — D11-5 가 이미 제목 폭을
          깎았고, 같은 줄에 시각을 얹으면 그 손실이 겹친다. **메타 줄에도 합치지 않는다**
          — 그 줄은 `line-clamp-1` 이라 시각을 앞에 붙이면 주소가 먼저 잘린다.

          **[#625](https://github.com/8llow8llowMe/hondigagae/issues/625) 의 산책 위험도가
          이 줄에 붙는다** (D15-5). `시각 있음` 이 배지가 설 조건 중 하나라 이 블록
          자체를 벗어나지 않는다 — 시각이 없으면 위험도 자리도 함께 사라진다.
        */}
        {startTime !== null && (
          <p className="text-caption text-fg-muted flex flex-wrap items-center gap-x-1 font-medium tabular-nums">
            <span>
              <span className="sr-only">{messages.plan.startTimeSrLabel} </span>
              <time dateTime={startTime}>{startTime}</time>
            </span>

            {walkSafetyView?.kind === 'badge' && (
              <>
                <span aria-hidden="true">·</span>
                <MetricBadge size="sm" tone={walkSafetyView.tone} axis="walkSafety">
                  {walkSafetyView.label}
                </MetricBadge>
              </>
            )}

            {/*
              **체감온도는 배지가 선 정상 판정에만 함께 낸다** (D15-7) — `UNKNOWN` 등급이나
              사유 문장은 배지 없이 캡션 한 줄로 따로 그린다. `최고 체감온도`(하루 최대)와
              라벨로 기준을 가른다 — 여기는 `feelsLikeCelsius`(시각 기준) 하나뿐이고
              폴백이 없다.
            */}
            {walkSafetyView?.kind === 'badge' && feelsLike !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {messages.plan.walkSafetyFeelsLikeLabel} {feelsLike}℃
                </span>
              </>
            )}
          </p>
        )}

        {/*
          사유 문장 — `LOOKUP_FAILED`·모르는 코드·등급 `UNKNOWN` (D15-4 · D15-7). **재시도
          버튼은 여기 없다** — 다섯 중 `LOOKUP_FAILED` 만 일시 장애고, 그 재시도는 항목
          단건 API 가 없어 일자 카드에 **하나**만 선다(`PlanDaySection`).
        */}
        {(walkSafetyView?.kind === 'sentence' || walkSafetyView?.kind === 'retriable') && (
          <p className="text-caption text-fg-muted mt-1">{walkSafetyView.text}</p>
        )}

        {/*
          반려견 특성이 이 항목 판정에만 빠졌다 (#717). **사유 문장과 배타가 아니다** —
          배지가 선 정상 판정에서도, 사유 문장이 선 줄에서도 어긋남은 따로 생긴다.
          조건은 위 `showPetConditionNote` 가 소유한다(거기 근거가 있다).
        */}
        {showPetConditionNote && (
          <p className="text-caption text-fg-muted mt-1">
            {messages.plan.walkSafetyPetConditionMissing}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* 공백 없는 긴 한국어 이름(`제주특별자치도립김창열미술관`)이 넘치지 않게
              어절 안에서도 끊을 수 있게 한다 — PlaceRow 와 같은 규칙 */}
          <h4
            className={cn(
              'text-title-2 min-w-0 font-semibold break-words',
              item.visited ? 'text-fg-muted' : 'text-fg',
            )}
          >
            {item.title}
          </h4>
          {/* `장소` 는 기본값이라 라벨이 잡음이다. 성격이 다른 유형만 알린다 */}
          {item.itemType.code !== 'PLACE' && <Badge size="sm">{item.itemType.name}</Badge>}
          {/*
            **`다녀옴` 배지를 걷었다** (#653 · 진단 PL-5 · 명세 D11-5). 낱말로 말한다는
            #124 의 요구는 그대로인데, **그 일을 이제 토글 버튼이 한다** — 버튼이
            `iconOnly` 를 벗고 `다녀옴` 을 달면서 배지와 같은 낱말이 한 행에 두 번 섰다.
            남길 쪽은 버튼이다: 체크 **전에도** 보여 `✓` 가 무엇인지 말해 준다.
          */}
        </div>

        {/* nullable 은 오류가 아니라 숨김이다. 둘 다 없으면 줄 자체가 사라진다 */}
        {meta !== null && (
          <p className="text-caption text-fg-muted mt-1 line-clamp-1 font-medium">{meta}</p>
        )}

        <PlanItemDistance model={model} />
      </div>
    </>
  )

  // L1 카드 안의 L2 항목 — 구분선은 `SurfaceList` 가 사이에만 긋는다, 그래서 `last` 가 없다 (#447)
  return (
    <li className={INSET_CLASS.card}>
      <div className="flex items-start">
        {href === null ? (
          <div className="flex min-w-0 flex-1 items-start gap-3 py-3 lg:gap-5 lg:py-4">{body}</div>
        ) : (
          // 링크 안에 링크를 넣지 않는다 — 행 전체가 하나의 링크다 (D6).
          // 방문 토글은 이 링크의 **형제**라 중첩되지 않는다 (#124)
          <Link
            href={href}
            className="focus-visible:ring-brand-500 flex min-w-0 flex-1 items-start gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none lg:gap-5 lg:py-4"
          >
            {body}
          </Link>
        )}

        {visit !== undefined && <PlanItemVisitToggle item={item} visit={visit} />}
      </div>

      {/*
        실패는 **토스트가 아니라 이 자리에 남는다** — 사라지는 UI 에 복구 수단을 두지
        않는다 (`components/toast.tsx`). **별도 `다시 시도` 버튼을 두지 않는다**: 실패해도
        서버 상태가 그대로라 토글이 아직 같은 방향을 가리키고, 그것을 다시 누르는 것이
        재시도다 — 실내 대안 담기(`plan-indoor-alts.tsx`)와 같은 판단이다.
      */}
      {visit !== undefined && visit.error !== null && (
        <FormAlert className="mb-3" message={visit.error.message} />
      )}
    </li>
  )
}

/**
 * 방문 체크 토글 — 후행 44px 아이콘 열 (#124).
 *
 * **`aria-pressed` 토글이다.** `Checkbox` 는 라벨이 요소 옆에 붙는 폼 입력이라 행 후행
 * 액션에 맞지 않고, 저장소는 이런 토글을 `aria-pressed` 로 쓴다 (`chip.tsx`).
 *
 * **이름은 상태가 아니라 누르면 일어날 일을 말한다.** `aria-pressed` 가 이미 현재
 * 상태를 읽어 주므로 이름까지 상태를 말하면 스크린리더가 같은 사실을 두 번 듣는다.
 */
function PlanItemVisitToggle({
  item,
  visit,
}: {
  item: PlanItemRowModel['item']
  visit: PlanItemVisit
}) {
  /*
    **출발 전에는 `다녀옴 표시` 글자를 접는다** (#732 · 진단 665-7). D-1 화면에서 가장 많이
    반복되는 문자열이 그것이었다 — 아무도 다녀오지 않은 일정의 **모든 항목**에 붙어 있었다.

    **체크된 행은 접지 않는다.** `다녀옴` 은 상태를 말하는 유일한 낱말이고, 접으면 그
    사실이 색(`variant`)과 아이콘으로만 남는다 (DESIGN.md §7). 접는 것은 반복되는 쪽뿐이다.

    **`aria-label` 은 두 갈래 모두 그대로다** — 스크린리더가 듣는 것은 변하지 않고, 보이는
    글자가 없어지면 WCAG 2.5.3(Label in Name) 은 애초에 걸리지 않는다. #653 이 글자를
    붙이면서 새로 생긴 제약이라 글자를 거두면 함께 사라진다.
  */
  const iconOnly = visit.compact && !item.visited

  const shared = {
    /*
      **상태를 `variant` 로 말한다.** `className` 으로 색을 덮지 않는다 —
      component-guide.md §3 이 금지한다. 표준 집합 안에서 `secondary`(테두리 + 진한
      글자)와 `ghost`(맨 아이콘)의 차이가 눌린 상태를 그린다.
    */
    variant: item.visited ? ('secondary' as const) : ('ghost' as const),
    size: 'md' as const,
    'aria-label': item.visited ? messages.plan.visitedAction : messages.plan.visitAction,
    'aria-pressed': item.visited,
    loading: visit.pending,
    leading: <CheckIcon size={20} />,
    onClick: () => visit.onToggle(!item.visited),
  }

  return (
    // 썸네일 상단에 맞춘다 — 행이 길어져도 토글이 가운데로 흐르지 않는다
    <div className="shrink-0 py-2 lg:py-3">
      {iconOnly ? (
        <Button {...shared} iconOnly />
      ) : (
        <Button {...shared}>
          {/*
            **`iconOnly` 를 벗었다** (#653 · 진단 PL-5). `✓` 하나로는 방문 완료인지 동반
            확인인지 알 수 없었다 — `aria-label` 과 `aria-pressed` 는 **이미 있었으므로
            스크린리더는 뜻을 들었고, 눈으로 볼 때만 뜻이 없었다.** 그것도 체크 **전에만**
            그랬다(체크하면 행에 `다녀옴` 배지가 떴다). 즉 기능을 모르는 사람에게만 안 보였다.

            **보이는 글자가 상태에 따라 갈린다.** 체크 전에 `다녀옴` 이라고 적으면 훑는
            사람에게 그 행이 이미 다녀온 것으로 읽힌다 — 모르는 것보다 **틀리게 아는 것**이
            나쁘다. 체크 전에는 누르면 일어날 일(`다녀옴 표시`)을, 뒤에는 상태(`다녀옴`)를
            말한다.

            **체크 전 `aria-label` 은 이 글자와 같다** (WCAG 2.5.3 Label in Name). 이름이
            `다녀옴으로 표시` 이고 글자가 `다녀옴 표시` 면 음성 제어 사용자가 보이는 그대로
            말했을 때 이 버튼이 잡히지 않는다 — 아이콘만이던 시절에는 보이는 글자가 없어
            성립하던 규칙이라 **글자를 붙이면서 새로 깨진 것**이다. 체크 뒤는
            `다녀옴` ⊂ `다녀옴 표시 해제` 라 이미 포함 관계다.

            **출발 전 미체크 행은 다시 아이콘만이다** (#732) — 위 `iconOnly` 주석 참고.
          */}
          {item.visited ? messages.plan.visitedLabel : messages.plan.visitToggleLabel}
        </Button>
      )}
    </div>
  )
}

/**
 * 거리 한 줄.
 *
 * **"직선" 을 반드시 붙인다.** 제주는 산간·해안도로가 많아 직선거리와 주행거리가 크게
 * 다르다 — `4.1km` 만 쓰면 주행거리로 읽힌다 (D3).
 *
 * 30km 이상이면 **그 행만** 경고 톤이다. 별도 경고 배지를 만들지 않는다 — 행 자체가
 * 말하는 것이 편집 동기를 만든다 (아트보드 01 주석). 색만으로 전달하지 않으려고
 * 문장(`— 하루 이동이 깁니다.`)이 함께 간다.
 */
function PlanItemDistance({ model }: { model: PlanItemRowModel }) {
  if (model.distanceKind === null || model.distanceMeters === null) return null

  const distance = formatDistance(model.distanceMeters)
  const template =
    model.distanceKind === 'lodging'
      ? messages.plan.distanceFromLodging
      : messages.plan.distanceFromPrevious
  const long = isLongTrip(model.distanceMeters)

  return (
    <p
      className={cn(
        'text-caption mt-1 font-medium tabular-nums',
        long ? 'text-metric-low-700' : 'text-fg-muted',
      )}
    >
      {template.replace('{distance}', distance)}
      {long && messages.plan.longTripSuffix}
    </p>
  )
}
