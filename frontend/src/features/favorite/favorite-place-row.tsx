'use client'

import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { FormAlert } from '@/components/form-alert'
import { BookmarkIcon, ImageIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { placeMetaLine } from '@/lib/place/meta'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { FavoritePlaceItem } from '@/types/favorite'

/**
 * 저장한 장소 행 — **L1 카드 안의 L2 항목이다** (`DESIGN.md §0`).
 * 아트보드 `혼디가개 저장한 장소` 01·03.
 *
 * **자기 테두리를 두르지 않는다** — 구분선은 `SurfaceList` 가 항목 **사이에만** 긋고,
 * xl 2열의 어긋나는 두 군데(첫 시각적 행의 오른쪽 칸 위선 · 열 사이 세로선)는
 * `columns={2}` 가 맡는다. 그래서 `last`·`lastGridRow`·`columnDivider` 세 prop 이
 * 사라졌다 — **마지막 행인지, 몇 번째 칸인지 아는 것은 행의 일이 아니다** (#462).
 *
 * **좌우 인셋은 담는 곳이 정한다** (`inset.ts`). 기본은 카드 안(16/20)이다.
 *
 * **`PlaceRowContent` 를 재사용하지 않는다.** `PlaceSummary` 는 `contentType`·
 * `petAllowanceType` 이 metadata 객체인데 여기는 `contentTypeName`·`petAllowanceName`
 * 평문이고, 무엇보다 **`title` 이 nullable 이다.** 억지로 맞추면 `PlaceRowContent` 에
 * nullable 분기가 생겨 장소 목록 쪽이 오염된다 (명세 D2).
 *
 * **행 전체를 링크로 감싸지 않는다.** `<a>` 안에 `<button>`(저장 해제)을 넣을 수 없다 —
 * 제목만 링크로 두고 버튼을 형제로 놓는다 (`plan-add-place-row.tsx` 와 같은 구조).
 *
 * **저장일을 그리지 않는다.** 아트보드 03 은 행마다 `2026-08-30 저장` 을 표시하지만
 * `FavoritePlaceItem` 에 날짜 필드가 없다 — DB 에는 있고 응답에 없다 (명세 D9-1).
 */
export function FavoritePlaceRow({
  item,
  inset = 'card',
  unsaved,
  pending,
  disabled,
  error,
  index,
  onToggle,
}: {
  item: FavoritePlaceItem
  /** 좌우 인셋. 담는 곳이 정한다 (`inset.ts`) */
  inset?: Inset
  /** 이 세션에서 해제했다. **행은 남고 버튼만 "저장" 으로 돌아간다** (명세 D4) */
  unsaved: boolean
  pending: boolean
  /** 다른 행이 처리 중 — 요청이 겹치면 무효화 순서가 꼬인다 */
  disabled: boolean
  error: string | null
  /** 되살릴 때 돌아갈 자리. 해제해도 행이 사라지지 않게 하는 근거다 (명세 D4) */
  index: number
  onToggle: (item: FavoritePlaceItem, index: number) => void
}) {
  const thumbnail = imageSrc(item.firstImage)
  const meta = placeMetaLine(item.addr, item.indoor)
  const href = `/places/${item.placeId}`

  return (
    <li className={INSET_CLASS[inset]}>
      <div className="flex items-center gap-3 py-3 lg:gap-5 lg:py-4">
        <div className="bg-band relative size-20 shrink-0 overflow-hidden rounded-md lg:size-24">
          {/* 미등록 호스트를 next/image 에 넘기면 런타임에 던진다 — 플레이스홀더로 떨어뜨린다 */}
          {thumbnail !== null ? (
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="(min-width: 1024px) 96px, 80px"
              className="object-cover"
            />
          ) : (
            <span className="text-fg-subtle absolute inset-0 flex flex-col items-center justify-center gap-1">
              <ImageIcon size={20} />
              <span className="text-caption text-fg-muted font-medium">
                {messages.place.noImage}
              </span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {item.title === null ? (
            <MissingSummary placeId={item.placeId} href={href} />
          ) : (
            <>
              {/* 공백 없는 긴 한국어 이름(`제주특별자치도립김창열미술관`)이 넘친다 —
                  break-words 로 "다른 방법이 없을 때만" 어절 안에서 끊게 한다 */}
              <h3 className="text-title-2 text-fg line-clamp-2 font-semibold break-words">
                <Link
                  href={href}
                  className="hover:text-link focus-visible:ring-brand-500 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  {item.title}
                </Link>
              </h3>

              {/* nullable 은 에러가 아니라 숨김이다. 둘 다 없으면 줄 자체가 사라진다 */}
              {meta !== null && (
                <p className="text-caption text-fg-muted mt-1 line-clamp-1 font-medium tabular-nums">
                  {meta}
                </p>
              )}

              <FavoriteBadges item={item} />
            </>
          )}
        </div>

        {/*
          **아이콘 버튼이다** — 아트보드 01 "아이콘만 빈 상태로 바뀐다" · 03 "저장 해제는
          아이콘 버튼으로 줄인다". 장소 상세 하단 바(`place-detail-action-bar.tsx`)와 **같은
          토글**이라 두 화면이 같은 언어를 쓴다: 채워진 북마크 = 저장됨.

          텍스트 버튼("저장 해제")을 쓰면 2열에서 한 행이 660px 이 되었을 때 이름과 버튼
          사이가 크게 벌어지고, 무엇보다 상세의 아이콘 토글과 같은 일이 다른 모양으로 보인다.

          이름이 `aria-label` 에만 있고 **누른 상태는 `aria-pressed` 로 말한다** — 아이콘
          채움만으로는 스크린리더가 저장 여부를 알 수 없다 (상세와 같은 판단).
        */}
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => onToggle(item, index)}
            disabled={pending || (disabled && !pending)}
            aria-pressed={!unsaved}
            aria-label={
              item.title === null
                ? unsaved
                  ? messages.favorite.save
                  : messages.favorite.unsave
                : unsaved
                  ? messages.favorite.saveLabel.replace('{title}', item.title)
                  : messages.favorite.unsaveLabel.replace('{title}', item.title)
            }
            className={cn(
              // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
              'border-border-strong focus-visible:ring-brand-500 flex size-11 shrink-0 items-center justify-center rounded-md border focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60',
              unsaved ? 'bg-bg' : 'bg-band',
            )}
          >
            <BookmarkIcon size={20} fill={unsaved ? 'none' : 'currentColor'} className="text-fg" />
          </button>
        </div>
      </div>

      {error !== null && <FormAlert className="mb-3" message={error} />}
    </li>
  )
}

/**
 * 요약을 못 받은 행 — 아트보드 01·03.
 *
 * **행을 감추지 않는다.** `title` 이 null 인 것은 tour-service 조회 실패이지 저장이 사라진
 * 것이 아니다. 감추면 "저장한 게 사라졌다" 가 된다 (명세 D5).
 *
 * **이름이 없으니 제목을 링크로 만들지 않는다.** 대신 명시적인 링크를 아래에 준다 —
 * 링크 이름이 "이름을 불러오지 못했어요" 가 되면 스크린리더에서 무엇으로 가는 링크인지 모른다.
 */
function MissingSummary({ placeId, href }: { placeId: string; href: string }) {
  return (
    <>
      <h3 className="text-title-2 text-fg-muted font-semibold">{messages.favorite.missingTitle}</h3>
      <p className="text-caption text-fg-muted mt-1 tabular-nums">
        {messages.favorite.missingTitlePlaceId.replace('{placeId}', placeId)}
      </p>
      <Link
        href={href}
        className="text-caption text-link focus-visible:ring-brand-500 mt-1 inline-flex min-h-11 items-center font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        {messages.favorite.missingTitleAction}
      </Link>
    </>
  )
}

/**
 * 행 태그. **등급 색을 쓰지 않는다** — 동반 가능/불가는 적합도 등급이 아니라 장소의
 * 속성이고, 색을 주면 사용자가 그것을 적합도 신호로 읽는다 (DESIGN.md §2-3).
 */
function FavoriteBadges({ item }: { item: FavoritePlaceItem }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {item.petAllowanceName !== null && (
        <Badge tone="neutral" size="sm">
          {item.petAllowanceName}
        </Badge>
      )}
      {item.contentTypeName !== null && (
        <Badge tone="neutral" size="sm">
          {item.contentTypeName}
        </Badge>
      )}

      {/* 실내 여부를 모르면 점선으로 "모름" 을 드러낸다 (styling-guide.md §3 unknown).
          `null` 은 "야외" 가 아니라 "원천에 정보 없음" 이다 */}
      {item.indoor === null && (
        <MetricBadge tone="unknown" size="sm">
          {messages.place.rowIndoorUnknown}
        </MetricBadge>
      )}
    </div>
  )
}
