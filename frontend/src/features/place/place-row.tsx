import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ChevronRightIcon, ImageIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { Row } from '@/components/surface'
import { isAllowedImageHost } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { cn } from '@/lib/utils/cn'
import type { PlaceSummary } from '@/types/place'

/**
 * PlaceRow — **카드가 아니라 행이다** (디자인 가이드 §5).
 * 아트보드 `혼디가개 장소 찾기.dc.html` 01(모바일) · 03(데스크톱) 절.
 *
 * 테두리·라운드·그림자 없이 전폭으로 놓고 구분선으로 나눈다.
 *
 * 썸네일 80(모바일) / 96(데스크톱) · radius 8. **`firstImage` 가 null 이어도 같은
 * 크기의 "이미지 없음" 타일을 남긴다** — 행 높이가 흔들리면 목록을 훑을 수 없다.
 * (장소 상세의 `PhotoGallery` 는 반대다. 0장이면 섹션을 아예 렌더하지 않는다.)
 *
 * **목록 API 가 적합도 점수를 주지 않으므로 배지·점수를 그리지 않는다** —
 * 근거를 댈 수 없다. 적합도는 상세에서만 말한다 (docs/screen-inventory.md §3).
 * 같은 이유로 아트보드의 **거리(`4.1km`)와 설명 한 줄도 그리지 않는다** — 목록 응답에 없다.
 */
export function PlaceRow({ place, last = false }: { place: PlaceSummary; last?: boolean }) {
  return (
    <Row as="li" last={last}>
      <Link
        href={`/places/${place.placeId}`}
        className="focus-visible:ring-brand-500 flex items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none lg:gap-5 lg:py-4"
      >
        <PlaceRowContent place={place} />
        <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
      </Link>
    </Row>
  )
}

/**
 * 행의 **내용**만 — 썸네일 · 제목 · 메타 · 태그.
 *
 * 링크 래퍼에서 떼어낸 이유: 일정에 담는 화면(#82)은 행에 `담기` 버튼을 두어야 하는데
 * **`<a>` 안에 `<button>` 을 넣을 수 없다.** 그쪽은 내용을 링크로 감싸지 않고
 * `titleHref` 로 제목만 링크로 만든다. 내용을 복제하면 두 목록의 행이 갈리므로 여기서 공유한다.
 */
export function PlaceRowContent({
  place,
  titleHref,
}: {
  place: PlaceSummary
  /**
   * 주면 제목만 링크가 된다. **행 전체가 링크인 쪽(`PlaceRow`)은 주지 않는다** —
   * 링크 안에 링크가 중첩된다.
   */
  titleHref?: string
}) {
  const hasImage = isAllowedImageHost(place.firstImage) && place.firstImage !== null
  const meta = [shortAddress(place.addr1), indoorLabel(place.indoor)].filter(
    (part): part is string => part !== null,
  )

  return (
    <>
      <div className="bg-band relative size-20 shrink-0 overflow-hidden rounded-md lg:size-24">
        {/* 미등록 호스트를 next/image 에 넘기면 런타임에 던진다 — 플레이스홀더로 떨어뜨린다 */}
        {hasImage ? (
          <Image
            src={place.firstImage as string}
            alt=""
            fill
            sizes="(min-width: 1024px) 96px, 80px"
            className="object-cover"
          />
        ) : (
          <span className="text-fg-subtle absolute inset-0 flex flex-col items-center justify-center gap-1">
            <ImageIcon size={20} />
            <span className="text-caption text-fg-muted font-medium">{messages.place.noImage}</span>
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* 한국어 실데이터는 길다. body 의 word-break: keep-all 은 어절 단위로만
              끊으므로 `제주특별자치도립김창열미술관` 처럼 공백 없는 긴 이름이 넘친다.
              break-words 로 "다른 방법이 없을 때만" 어절 안에서 끊게 한다. */}
        <h3 className="text-title-2 text-fg line-clamp-2 font-semibold break-words">
          {titleHref === undefined ? (
            place.title
          ) : (
            <Link
              href={titleHref}
              className="hover:text-link focus-visible:ring-brand-500 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {place.title}
            </Link>
          )}
        </h3>

        {/* nullable 은 에러가 아니라 숨김이다. 둘 다 없으면 줄 자체가 사라진다 */}
        {meta.length > 0 && (
          <p className="text-caption text-fg-muted mt-0.5 line-clamp-1 font-medium tabular-nums">
            {meta.join(' · ')}
          </p>
        )}

        <PlaceBadges place={place} className="mt-1.5 lg:hidden" />
      </div>

      {/* 데스크톱은 태그를 우측 열로 뺀다 — 아트보드 03 절 (폭 220 우측 정렬) */}
      <PlaceBadges place={place} className="hidden w-56 shrink-0 justify-end lg:flex" />
    </>
  )
}

/**
 * 행 태그.
 *
 * 동반 가능 여부를 첫 태그로 — 가이드 §5. **등급 색을 쓰지 않는다.** 동반 가능/불가는
 * 적합도 등급이 아니라 장소의 속성이고, 색을 주면 사용자가 그것을 적합도 신호로 읽는다.
 * 구분은 서버 `name` 문구가 맡는다 (DESIGN.md §2-3).
 */
function PlaceBadges({ place, className }: { place: PlaceSummary; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Badge tone="neutral" size="sm">
        {place.petAllowanceType.name}
      </Badge>
      <Badge tone="neutral" size="sm">
        {place.contentType.name}
      </Badge>

      {/* 실내 여부를 모르면 점선으로 "모름" 을 드러낸다 (styling-guide.md §3 unknown).
          숨기면 실내만·야외만 필터에서 이 장소가 왜 사라지는지 설명할 길이 없다.
          `size="sm"` 은 옆의 `Badge size="sm"` 과 높이를 맞추기 위해서다 */}
      {place.indoor === null && (
        <MetricBadge tone="unknown" size="sm">
          {messages.place.rowIndoorUnknown}
        </MetricBadge>
      )}
    </div>
  )
}

/** `null` 은 "야외" 가 아니라 "모름" 이다 — 메타 줄에서 빼고 배지가 대신 말한다 */
function indoorLabel(indoor: boolean | null): string | null {
  if (indoor === null) return null
  return indoor ? messages.place.rowIndoor : messages.place.rowOutdoor
}
