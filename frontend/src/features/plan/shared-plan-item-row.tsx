import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ImageIcon } from '@/components/icons'
import { imageSrc } from '@/lib/image/remote-host'
import { placeMetaLine } from '@/lib/place/meta'
import { planItemTimeLabel } from '@/lib/plan/date'
import { isPlaceTargetOf } from '@/lib/plan/detail'
import { INSET_CLASS } from '@/lib/ui/inset'
import type { SharedPlanItem } from '@/types/plan'

/**
 * 공유받은 일정의 항목 행 — 읽기 전용 (#628).
 *
 * **`PlanItemRow` 를 재사용하지 않는다.** 그쪽은 `PlanItemRowModel`(거리 계산 · 결손
 * 판정 결과)을 받고 방문 체크 토글 열을 갖는데, 공유 항목에는 **`planItemId` 가 없어
 * 토글을 만들 수 없고** 거리 축도 쓰지 않는다. optional prop 을 붙여 한 컴포넌트에 두
 * 화면을 태우면 안 쓰는 갈래가 계속 늘고, 그중 하나가 남의 화면에 새는 날이 온다.
 *
 * **`startTime` 을 표시한다** — 소유자 상세가 시각을 숨기는 것(일정상세-세부명세 D8-9)과
 * 갈린다. 받은 사람에게는 "어디를" 만큼 "언제" 가 중요하고, 편집 화면이 아니라 시간
 * 열이 순번 칩과 경합하지 않는다. `null` 이면 그 자리가 빈다 — `00:00` 으로 채우지 않는다.
 *
 * **`place` 는 통째로 `null` 일 수 있다** — `WALK`·`MOVE` 처럼 장소가 아닌 항목이거나
 * 원천에서 사라진 장소다. 그때도 **행을 지우지 않고 제목만 남긴다** (공통명세 S8).
 *
 * `'use client'` 가 없다 — 상호작용이 장소 링크 하나뿐이라 서버에서 그린다.
 */
export function SharedPlanItemRow({ item }: { item: SharedPlanItem }) {
  const { place } = item
  const thumbnail = imageSrc(place?.firstImage ?? null)
  const meta = placeMetaLine(place?.addr1 ?? null, place?.indoor ?? null)
  const time = planItemTimeLabel(item.startTime)

  /*
    **`targetId` 가 있다고 링크하지 않는다.** `WALK` 의 `targetId` 는 `walk_course.id` 라
    `/places/{id}` 로 보내면 남의 id 로 404 를 만든다 — 소유자 행과 같은 판정이다.

    `isPlaceTarget` 을 쓰지 않는 것은 그 함수가 `PlanItemDetail` 을 받기 때문이다. 판정
    집합은 같아야 하므로 **같은 모듈의 판정을 쓴다** — 여기서 집합을 복사하면 백엔드가
    유형을 늘렸을 때 한쪽만 고쳐지고, 그 어긋남은 "공유 링크로 열면 장소 링크만 안
    걸린다" 로 나타나 눈에 잘 띄지 않는다.
  */
  const href = isPlaceTargetOf(item.itemType.code, item.targetId)
    ? `/places/${item.targetId as string}`
    : null

  const body = (
    <>
      <div className="bg-band relative size-20 shrink-0 overflow-hidden rounded-md lg:size-24">
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

        {/* 순번 칩 — 자료가 아니라 순서 표시라 a11y 트리에서 뺀다 (목록 구조가 이미 말한다) */}
        <span
          aria-hidden
          className="bg-fg text-fg-inverse text-caption absolute top-1 left-1 inline-flex size-5 items-center justify-center rounded-sm font-bold tabular-nums"
        >
          {item.sequence + 1}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* 시각은 제목 앞이다 — 목록을 훑는 눈이 시간 순서를 먼저 읽는다 */}
          {time !== null && (
            <span className="text-body-2 text-fg-muted font-semibold tabular-nums">{time}</span>
          )}
          {/* 공백 없는 긴 한국어 이름이 넘치지 않게 어절 안에서도 끊는다 — 소유자 행과 같은 규칙 */}
          <h3 className="text-title-2 text-fg min-w-0 font-semibold break-words">{item.title}</h3>
          {/* `장소` 는 기본값이라 라벨이 잡음이다. 성격이 다른 유형만 알린다 */}
          {item.itemType.code !== 'PLACE' && <Badge size="sm">{item.itemType.name}</Badge>}
        </div>

        {/* nullable 은 오류가 아니라 숨김이다. 둘 다 없으면 줄 자체가 사라진다 */}
        {meta !== null && (
          <p className="text-caption text-fg-muted mt-1 line-clamp-1 font-medium">{meta}</p>
        )}
      </div>
    </>
  )

  // L1 카드 안의 L2 항목 — 구분선은 `SurfaceList` 가 사이에만 긋는다 (#447)
  return (
    <li className={INSET_CLASS.card}>
      {href === null ? (
        <div className="flex min-w-0 items-start gap-3 py-3 lg:gap-5 lg:py-4">{body}</div>
      ) : (
        <Link
          href={href}
          className="focus-visible:ring-brand-500 flex min-w-0 items-start gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none lg:gap-5 lg:py-4"
        >
          {body}
        </Link>
      )}
    </li>
  )
}
