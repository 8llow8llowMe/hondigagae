import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ChevronRightIcon, ImageIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { placeIllustration } from '@/lib/place/illustration'
import { placeMetaLine } from '@/lib/place/meta'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
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
 * 썸네일 80(모바일) / 96(데스크톱) · radius 8. **`firstImage` 가 null 이어도 같은
 * 크기의 "이미지 없음" 타일을 남긴다** — 행 높이가 흔들리면 목록을 훑을 수 없다.
 * (장소 상세의 `PhotoGallery` 는 반대다. 0장이면 섹션을 아예 렌더하지 않는다.)
 *
 * **목록 API 가 적합도 점수를 주지 않으므로 배지·점수를 그리지 않는다** —
 * 근거를 댈 수 없다. 적합도는 상세에서만 말한다 (docs/screen-inventory.md §3).
 * 같은 이유로 아트보드의 **거리(`4.1km`)와 설명 한 줄도 그리지 않는다** — 목록 응답에 없다.
 */
export function PlaceRow({ place, inset = 'card' }: { place: PlaceSummary; inset?: Inset }) {
  return (
    <li className={INSET_CLASS[inset]}>
      <Link
        href={`/places/${place.placeId}`}
        className="focus-visible:ring-brand-500 @container flex items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none @lg:gap-5 @lg:py-4"
      >
        <PlaceRowContent place={place} />
        <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
      </Link>
    </li>
  )
}

/**
 * 행의 **내용**만 — 썸네일 · 제목 · 메타 · 태그.
 *
 * ### breakpoint 가 아니라 컨테이너 쿼리인 이유
 *
 * 태그를 우측 고정 열(당시 `w-56` = 224px)로 빼는 규칙을 `lg:`(뷰포트)로 두었더니 **지도
 * 좌측 패널에서 제목이 한 글자로 잘렸다.** 그 패널은 데스크톱이지만 폭이 400px 이라,
 * 96px 썸네일 + gap + 224px 배지 열을 빼면 제목에 40~50px 만 남는다 (실측: `테…`).
 * 뷰포트는 컨테이너 폭을 모른다 — 그래서 `@lg:`(컨테이너)로 바꿨다. 소비처가 부모에
 * `@container` 를 주면 목록은 우측 열, 400px 패널은 수직 배치가 **같은 마크업**으로
 * 나온다. 아트보드 05 의 "행 마크업은 목록과 지도가 동일하다" 를 지키는 유일한 방법이다.
 *
 * ### 배지 열만 `@xl`(576)이고 나머지는 `@lg`(512)다 — 이슈 #553
 *
 * `/places` 목록이 `xl`(1280)부터 2열로 접히는데(`place-list-view.tsx`), **그 칸 폭이
 * `@lg` 경계를 정확히 스치고 있었다.** 1600 실측에서 왼쪽 칸 511px · 오른쪽 칸 512px —
 * 1px 차이로 **왼쪽은 배지가 제목 위, 오른쪽은 배지가 우측 열**이었다. 같은 목록의 두
 * 칸이 다른 배치로 그려진 것이고, 우측 열이 된 칸은 제목에 184px 만 남아 실데이터
 * 제목이 거의 전부 두 줄로 꺾였다.
 *
 * 배지 열 전환점만 `@xl` 로 올린다. 2열 칸은 1440 캡에서 **최대 555px** 이라 항상 그
 * 아래고, 1열 목록은 1024 에서도 654px 이라 항상 그 위다 — **"2열이면 배지가 위, 1열이면
 * 오른쪽"** 이 폭과 무관하게 결정된다.
 *
 * 썸네일 크기·간격(`@lg:size-24` · `@lg:gap-5`)은 그대로 512 다. 그것들은 배치가 아니라
 * 밀도라 경계를 같이 옮길 이유가 없다.
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
  const thumbnail = imageSrc(place.firstImage)
  const illustration = placeIllustration(place.contentType.code)
  const meta = placeMetaLine(place.addr1, place.indoor)

  return (
    <>
      <div className="bg-band relative size-20 shrink-0 overflow-hidden rounded-md @lg:size-24">
        {/* 미등록 호스트를 next/image 에 넘기면 런타임에 던진다 — 플레이스홀더로 떨어뜨린다 */}
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
            사진이 없으면 카테고리 일러스트로 채운다 (`lib/place/illustration.ts`).
            **`next/image` 가 아니라 `<img>` 다** — 저장소 안의 정적 SVG 라 최적화할
            것이 없고(`unoptimized: true`), 원격 호스트 허용 목록과도 무관하다.
            **장식이므로 `alt=""` 다** — 카테고리는 아래 배지가 이미 낱말로 말한다.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={illustration} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="text-fg-subtle absolute inset-0 flex flex-col items-center justify-center gap-1">
            <ImageIcon size={20} />
            <span className="text-caption text-fg-muted font-medium">{messages.place.noImage}</span>
          </span>
        )}
      </div>

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

        {/* nullable 은 에러가 아니라 숨김이다. 둘 다 없으면 줄 자체가 사라진다 */}
        {meta !== null && (
          <p className="text-caption text-fg-muted mt-1 line-clamp-1 font-medium tabular-nums">
            {meta}
          </p>
        )}

        {/*
          좁은 컨테이너에서는 배지를 **제목 위**로 올린다 (`order-first`). 지도 패널에서
          행을 누르는 것은 "이름 찾기" 가 아니라 "이 핀 고르기" 라, 동반 가능 여부가
          먼저 읽히는 편이 낫다. **DOM 순서는 제목 → 메타 → 배지 그대로다** — 스크린리더는
          이름을 먼저 읽는다. 시각 순서만 바꾼다.
        */}
        <PlaceBadges place={place} className="order-first mb-1.5 @xl:hidden" />
      </div>

      {/*
        넓은 컨테이너는 태그를 우측 열로 뺀다 — 아트보드 03 절.

        **폭이 224 → 176 으로 줄었다** (이슈 #553). 이 갈래가 남는 가장 좁은 자리는
        1024 의 1열 목록(654px)인데, 썸네일 96 + 간격 + 배지 224 + 화살표를 빼고 나면
        제목에 262px 밖에 남지 않았다. 배지는 두세 개에 `flex-wrap` 이라 줄어든 만큼 자기
        줄로 내려가면 되지만, **제목은 내려갈 곳이 없다.**

        **176 은 `동반 가능`(63) + `문화시설`(63) 이 간격 6 을 두고 한 줄에 서는 폭이다.**
        더 줄이면 그 흔한 조합부터 두 줄이 된다.
      */}
      <PlaceBadges place={place} className="hidden w-44 shrink-0 justify-end @xl:flex" />
    </>
  )
}

/**
 * 행 태그.
 *
 * 동반 가능 여부를 첫 태그로 — 가이드 §5. **등급 색을 쓰지 않는다.** 동반 가능/불가는
 * 적합도 등급이 아니라 장소의 속성이고, 색을 주면 사용자가 그것을 적합도 신호로 읽는다.
 * 구분은 서버 `name` 문구가 맡는다 (DESIGN.md §2-3).
 *
 * **`petAllowanceType.code === 'UNKNOWN'` 이면 그 태그를 그리지 않는다** (#530). 서버
 * `name` 이 `정보 없음` 이라, 그대로 두면 옆의 카테고리 태그와 나란히 서서 **무엇의
 * 정보가 없다는 것인지 말하지 않는 배지**가 된다 — 읽는 사람은 바로 옆 태그에 걸어 읽는다.
 *
 * **낱말을 보태지 않는다.** 실내 여부는 `place-row 실내 정보 없음` 처럼 명세가 문구를
 * 정해 둬 점선 배지로 남지만(아래), 동반 가능 여부는 그런 문구가 없다 — 여기서 지어내면
 * FE 가 서버 문구를 다시 쓰는 것이 된다 (api-integration-guide.md §6).
 *
 * **`code` 로 거른다.** `name` 은 서버 문구라 언제든 바뀔 수 있고, 문구 비교는 그때
 * 조용히 어긋난다.
 */
function PlaceBadges({ place, className }: { place: PlaceSummary; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {place.petAllowanceType.code !== 'UNKNOWN' && (
        <Badge tone="neutral" size="sm">
          {place.petAllowanceType.name}
        </Badge>
      )}
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
