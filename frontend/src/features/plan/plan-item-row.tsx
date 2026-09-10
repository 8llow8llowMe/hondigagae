import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { CheckIcon, ImageIcon } from '@/components/icons'
import { formatDistance } from '@/lib/format/distance'
import { isLongTrip } from '@/lib/geo/distance'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { placeMetaLine } from '@/lib/place/meta'
import { isPlaceTarget, type PlanItemRowModel } from '@/lib/plan/detail'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

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
 * **`startTime` 을 표시하지 않는다** — 아트보드 헤더 주석이 "시간 없음" 으로 못박았다
 * (일정상세-세부명세 D8-9).
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
}: {
  model: PlanItemRowModel
  /** 없으면 토글이 렌더되지 않는다 — 기간 밖 항목 섹션이 그 경로다 */
  visit?: PlanItemVisit
}) {
  const { item } = model
  const { place } = item
  const thumbnail = imageSrc(place?.firstImage ?? null)
  const meta = placeMetaLine(place?.addr1 ?? null, place?.indoor ?? null)

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
          {/* 색·투명도만으로 전달하지 않기 위한 낱말 (#124) */}
          {item.visited && (
            <Badge tone="brand" size="sm">
              {messages.plan.visitedLabel}
            </Badge>
          )}
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
  return (
    // 썸네일 상단에 맞춘다 — 행이 길어져도 토글이 가운데로 흐르지 않는다
    <div className="shrink-0 py-2 lg:py-3">
      <Button
        /*
          **상태를 `variant` 로 말한다.** `className` 으로 색을 덮지 않는다 —
          component-guide.md §3 이 금지한다. 표준 집합 안에서 `secondary`(테두리 + 진한
          글자)와 `ghost`(맨 아이콘)의 차이가 눌린 상태를 그린다.
        */
        variant={item.visited ? 'secondary' : 'ghost'}
        size="md"
        iconOnly
        aria-label={item.visited ? messages.plan.visitedAction : messages.plan.visitAction}
        aria-pressed={item.visited}
        loading={visit.pending}
        leading={<CheckIcon size={20} />}
        onClick={() => visit.onToggle(!item.visited)}
      />
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
