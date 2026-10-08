import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ChevronRightIcon } from '@/components/icons'
import { ThumbnailTile } from '@/components/thumbnail-tile'
import { placeTypeLabel } from '@/features/place/filter-labels'
import { listThumbnailSrc } from '@/lib/image/thumbnail'
import { messages } from '@/lib/messages'
import { placeIllustration } from '@/lib/place/illustration'
import { placeMetaLine } from '@/lib/place/meta'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import type { PlaceSummary } from '@/types/place'

/**
 * PlaceRow — **L1 카드 안의 L2 항목이다** (`DESIGN.md §0`).
 * 아트보드 `혼디가개 장소 찾기.dc.html` 01(모바일) · 03(데스크톱) 절.
 *
 * **자기 테두리를 두르지 않는다** — 구분선은 `SurfaceList` 가 항목 **사이에만** 긋는다.
 * 그래서 `last` prop 이 없다: 마지막 행을 아는 것이 행의 일이 아니다.
 *
 * **좌우 인셋은 담는 곳이 정한다** (`inset.ts` 의 같은 규칙). 이 행은 카드 안
 * (`/places` 목록, 16/20)과 카드 밖(지도 SDK 실패 폴백 목록, 16/40) 양쪽에서 쓰여
 * 값이 하나로 고정될 수 없다. 기본값을 `card` 로 두는 것은 3a 가 정본이기 때문이고,
 * 카드 밖 사용처가 스스로 밝히게 한다.
 *
 * 썸네일 80 정사각(좁은 칸) / 144×96 3:2(넓은 칸, #1276) · radius 8. **사진이 null 이어도 같은
 * 크기의 "이미지 없음" 타일을 남긴다** — 행 높이가 흔들리면 목록을 훑을 수 없다.
 * (장소 상세의 `PhotoGallery` 는 반대다. 0장이면 섹션을 아예 렌더하지 않는다.)
 *
 * **`priority` 는 첫 화면에 서는 몇 행만 준다** (#1132). 목록이 index 로 정한다
 * (`place-list-section.tsx`) — 행은 자기가 몇 번째인지 모른다.
 *
 * **목록 API 가 적합도 점수를 주지 않으므로 배지·점수를 그리지 않는다** —
 * 근거를 댈 수 없다. 적합도는 상세에서만 말한다 (docs/screen-inventory.md §3).
 * 같은 이유로 아트보드의 **거리(`4.1km`)와 설명 한 줄도 그리지 않는다** — 목록 응답에 없다.
 */
export function PlaceRow({
  place,
  inset = 'card',
  priority = false,
}: {
  place: PlaceSummary
  inset?: Inset
  /** 첫 화면 행이면 썸네일을 바로 받는다 (`lib/image/loading.ts`) */
  priority?: boolean
}) {
  return (
    <li className={INSET_CLASS[inset]}>
      <Link
        href={`/places/${place.placeId}`}
        className="focus-visible:ring-brand-500 @container flex items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none @lg:gap-5 @lg:py-4"
      >
        <PlaceRowContent place={place} priority={priority} />
        <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
      </Link>
    </li>
  )
}

/**
 * 행의 **내용**만 — 썸네일 · 제목 · 메타 · 태그.
 *
 * ### 크기 기준이 컨테이너인 이유
 *
 * 지도 좌측 패널은 데스크톱이지만 폭이 400px 이다. 뷰포트 breakpoint(`lg:`)는 그 칸 폭을 모른다 —
 * 그렇게 두었을 때 우측 배지 열이 서서 제목이 한 글자로 잘렸다(#240, 실측 `테…`). 그래서 썸네일
 * 크기 · 간격(`@lg:w-36 @lg:h-24` · `@lg:gap-5`)은 소비처가 연 `@container` 기준이다.
 *
 * **우측 배지 열은 #1267 에서 걷었다.** 칩이 동반 판정 하나라 따로 열을 둘 까닭이 없어졌다 — 그
 * 열(#553 의 `@xl` · 176)이 1024 1열 목록에서 제목 폭을 262 로 묶고 있었다.
 *
 * 링크 래퍼에서 떼어낸 이유: 일정에 담는 화면(#82)은 행에 `담기` 버튼을 두어야 하는데
 * **`<a>` 안에 `<button>` 을 넣을 수 없다.** 그쪽은 내용을 링크로 감싸지 않고
 * `titleHref` 로 제목만 링크로 만든다. 내용을 복제하면 두 목록의 행이 갈리므로 여기서 공유한다.
 */
export function PlaceRowContent({
  place,
  titleHref,
  priority = false,
}: {
  place: PlaceSummary
  /**
   * 주면 제목만 링크가 된다. **행 전체가 링크인 쪽(`PlaceRow`)은 주지 않는다** —
   * 링크 안에 링크가 중첩된다.
   */
  titleHref?: string
  /**
   * 첫 화면 행이면 썸네일을 바로 받는다 (`lib/image/loading.ts`, #1132).
   * **기본은 지연 로드다** — 지도 패널·담기 화면은 주지 않는다. 지도 화면의 LCP 는 지도
   * 타일이라, 행 사진의 우선순위를 올리면 그 타일과 대역폭을 다툰다.
   */
  priority?: boolean
}) {
  /*
    **작은 사진(`firstImage2`, 150×100 · ~20KB)이 먼저다** (#1132). 이 칸은 80~96px 인데
    `firstImage` 는 940px 원본(500~780KB)이라, 그것을 쓰던 `/places` 한 화면이 이미지만
    6.5MB 였다. 판정·폴백 규칙은 `listThumbnailSrc` 가 갖는다.
  */
  const thumbnail = listThumbnailSrc(place.firstImage2, place.firstImage)
  const illustration = placeIllustration(place.contentType.code)
  /*
    **분류가 메타 줄 맨 앞이다** (#1267) — `관광지 · 제주시 한경면 · 야외`. 예전에는 동반 칩 옆의
    두 번째 칩이었는데, 칩이 둘 셋이면 이름보다 무거웠다. 카페 분류 음식점은 `카페` 다(#1181).
    거리는 거리순 목록에서만 온다 — 그 밖에서는 `null` 이라 줄이 그대로다 (#1217).
  */
  const meta = [
    placeTypeLabel(place),
    placeMetaLine(place.addr1, place.indoor, place.distanceMeters),
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ')

  return (
    <>
      {/*
        **공통 `ThumbnailTile` 이다** (#1151). 사진은 장소명을 alt 로 주지 않는다 — 이 사진은 행
        링크(`PlaceRow`) · 선택 버튼(지도 패널) **안**에 있고 같은 컨트롤 안 `h3` 가 이미 장소명을
        말해, alt 에도 주면 접근 이름이 두 번 읽힌다 (#1132). 일러스트는 카테고리별이다
        (`lib/place/illustration.ts`) — 카테고리는 아래 배지가 낱말로 말한다.

        **크기 기준이 컨테이너다**(`@lg`) — 지도 패널처럼 화면은 넓어도 칸이 좁은 자리에 같은
        행이 들어간다.
      */}
      <ThumbnailTile
        src={thumbnail}
        illustration={illustration}
        emptyLabel={messages.place.noImage}
        sizeBasis="container"
        // 넓은 칸은 3:2 — 원본 비율이다. 좁은 칸(지도 패널 · 모바일)은 80 정사각 그대로 (#1276)
        wideShape="landscape"
        priority={priority}
      />

      {/*
        **이름 → 동반 칩 → 메타, 어느 폭이든 같다** (#1267). 예전에는 좁은 칸에서 칩을 이름 위로
        올리고(`order-first`) 넓은 칸(`@xl`)에서는 우측 176 열로 뺐다. 칩이 동반 판정 하나만 남아
        열을 따로 둘 까닭이 없어졌고, 그 열이 1024 1열 목록에서 이름 폭을 262 로 묶었다. 시각
        순서와 DOM 순서가 같아 스크린리더도 이름을 먼저 읽는다.
      */}
      <div className="flex min-w-0 flex-1 flex-col">
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

        <PetBadge place={place} />

        {/* 분류는 늘 있어 줄이 사라지지 않는다 */}
        <p className="text-caption text-fg-muted mt-1 line-clamp-1 font-medium tabular-nums">
          {meta}
        </p>
      </div>
    </>
  )
}

/**
 * 행의 칩 — **동반 판정 하나뿐이다** (#1267).
 *
 * 가이드 §5. **등급 색을 쓰지 않는다.** 동반 가능/불가는 적합도 등급이 아니라 장소의 속성이고,
 * 색을 주면 사용자가 그것을 적합도 신호로 읽는다. 구분은 서버 `name` 문구가 맡는다 (DESIGN.md §2-3).
 *
 * **`petAllowanceType.code === 'UNKNOWN'` 이면 그리지 않는다** (#530). 서버 `name` 이 `정보 없음`
 * 이라 무엇의 정보가 없다는 것인지 말하지 않는다. **`code` 로 거른다** — `name` 은 서버 문구라
 * 언제든 바뀔 수 있고, 문구 비교는 그때 조용히 어긋난다.
 *
 * **`실내 여부 미확인` 점선 배지는 목록 행에서 뺐다** (#1267). 모르는 정보를 행마다 반복하면
 * 잡음이다 — 메타 줄에서 실내/야외 낱말이 빠지는 것으로 충분하고, 배지는 상세 · 미리보기에 남는다.
 */
function PetBadge({ place }: { place: PlaceSummary }) {
  if (place.petAllowanceType.code === 'UNKNOWN') return null

  return (
    <div className="mt-1.5 flex">
      <Badge tone="neutral" size="sm">
        {place.petAllowanceType.name}
      </Badge>
    </div>
  )
}
