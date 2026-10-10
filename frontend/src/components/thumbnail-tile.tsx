import Image from 'next/image'

import { ImageIcon } from '@/components/icons'
import { imageLoadingProps } from '@/lib/image/loading'
import { cn } from '@/lib/utils/cn'

export type ThumbnailTileProps = {
  /**
   * `next/image` 에 넘길 수 있는 src — **호출부가 `imageSrc` · `listThumbnailSrc` 로 거른 값**이다.
   * 미등록 호스트를 넘기면 `next/image` 가 런타임에 던지므로 판정을 이 컴포넌트가 다시 하지
   * 않는다. `null` 이면 일러스트 → 회색 타일로 떨어진다.
   */
  src: string | null
  /**
   * 사진이 없을 때 그릴 저장소 안 정적 일러스트 경로. **무엇으로 고를지는 도메인이 안다** —
   * 장소는 `contentType`(`lib/place/illustration.ts`), 일정 항목은 `itemType`
   * (`lib/plan/illustration.ts`). `null` 이면 회색 타일이다.
   */
  illustration?: string | null
  /** 회색 타일 아이콘 밑 낱말(`사진 없음`). 주지 않으면 아이콘만 선다 */
  emptyLabel?: string
  /** 좌상단 순번 칩. 주지 않으면 칩이 없다 */
  ordinal?: number
  /**
   * 96px 로 커지는 기준. **장소 목록은 `container`** 다 — 지도 패널처럼 화면은 넓어도 칸이
   * 좁은 자리에 같은 행이 들어간다 (`place-row.tsx` · `@lg`). 나머지는 화면 기준이다.
   */
  sizeBasis?: 'viewport' | 'container'
  /**
   * 넓은 칸의 모양 (#1276). `square`(기본) = 96 정사각, `landscape` = 144×96(3:2). **좁은 칸(80)은
   * 언제나 정사각이다** — 그 자리는 제목 폭이 먼저다. 장소 행만 `landscape` 다: 원본이 3:2
   * (`firstImage2` 150×100 · `firstImage` 940×627)라 정사각 96 은 가로 1/3 을 잘랐다.
   */
  wideShape?: 'square' | 'landscape'
  /** 타일 전체를 뒤로 물린다 — 다녀온 항목(`plan-item-row.tsx`). 칩까지 함께 물러난다 */
  dimmed?: boolean
  /** 첫 화면 행이면 사진을 바로 받는다 (`lib/image/loading.ts`, #1132). 기본은 지연 로드 */
  priority?: boolean
}

/**
 * 넓은 칸 크기 클래스 — `기준 × 모양`. **문자열 그대로 둔다** — Tailwind 가 소스에서 찾아 생성한다.
 * `component-guide.md` §11 의 `Record<Union, string>` 맵이다.
 */
const WIDE_CLASS: Record<'viewport' | 'container', Record<'square' | 'landscape', string>> = {
  viewport: { square: 'lg:size-24', landscape: 'lg:h-24 lg:w-36' },
  container: { square: '@lg:size-24', landscape: '@lg:h-24 @lg:w-36' },
}

/** 넓은 칸의 사진 폭 — `sizes` 가 실제 표시 폭을 말해야 한다 */
const WIDE_PX: Record<'square' | 'landscape', number> = { square: 96, landscape: 144 }

/**
 * 목록 행의 썸네일 타일 — 80px, 넓으면 96px(정사각) 또는 144×96(3:2, #1276) (#1151).
 *
 * **다섯 행이 손으로 복제하던 것을 하나로 모았다** — 장소 · 즐겨찾기 · 일정 상세 · 공유 일정 ·
 * AI 초안. 복제는 이미 어긋나 있었다: 공유 일정 행은 #842(유형 일러스트)와 #856(흰 원형 칩)을
 * 받지 못해, 같은 일정이 소유자 화면과 공유 링크에서 다른 얼굴이었다 (#70 의 버튼 외형과
 * 같은 경로).
 *
 * **폴백 순서는 사진 → 일러스트 → 회색 타일이다** (#842). dev 실측으로 사진 없는 장소가
 * 70% 라 일러스트가 예외가 아니라 기본이다.
 *
 * **사진도 일러스트도 장식이라 `alt=""` 다.** 타일은 늘 행 안에 있고 같은 행의 제목이 이미
 * 이름을 말한다 — alt 에도 이름을 주면 링크 행의 접근 이름이 `{이름} {이름}` 으로 두 번
 * 읽힌다 (#1132 `place-row.tsx` 에서 따졌다).
 *
 * 도메인 용어(장소 · 일정)를 prop 에 두지 않는다 (`component-guide.md` §9).
 */
export function ThumbnailTile({
  src,
  illustration = null,
  emptyLabel,
  ordinal,
  sizeBasis = 'viewport',
  wideShape = 'square',
  dimmed = false,
  priority = false,
}: ThumbnailTileProps) {
  return (
    <div
      className={cn(
        'bg-band relative size-20 shrink-0 overflow-hidden rounded-md',
        WIDE_CLASS[sizeBasis][wideShape],
        // 이것만으로 전달하지 않는다 — 호출부가 배지 · 낱말로 같은 사실을 말한다 (DESIGN.md §7)
        dimmed && 'opacity-60',
      )}
    >
      {src !== null ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={`(min-width: 1024px) ${WIDE_PX[wideShape]}px, 80px`}
          className="object-cover"
          {...imageLoadingProps(priority)}
        />
      ) : illustration !== null ? (
        /*
          **`next/image` 가 아니라 `<img>` 다** — 저장소 안의 정적 자산이라 최적화할 것이
          없고(`unoptimized: true`) 원격 호스트 허용 목록과도 무관하다.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={illustration} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="text-fg-subtle absolute inset-0 flex flex-col items-center justify-center gap-1">
          <ImageIcon size={20} />
          {emptyLabel !== undefined && (
            <span className="text-caption text-fg-muted font-medium">{emptyLabel}</span>
          )}
        </span>
      )}

      {/*
        순번 칩 — 자료가 아니라 순서 표시라 a11y 트리에서 뺀다 (행 순서는 목록 구조가 말한다).

        **흰 원형이다** (#856). 예전 `bg-fg` 검정 사각은 `aria-hidden` 인 장식이 화면에서 가장
        진한 면을 쓰고 있었다. 원형은 동선 지도의 핀 번호와 같은 언어다 — 같은 순서를 두 화면이
        같은 모양으로 말한다. 타일 안에 두는 것은 행 폭을 뺏지 않기 위해서다.

        **그림자가 아니라 1px 테두리다.** 흰 칩이 밝은 타일 위에 서면 경계가 사라지는데, 그림자는
        이 저장소에서 떠 있는 것 전용이다 (`token-usage.test.ts` 의 `FLOATING` · DESIGN.md §0).
        크기와 자리(`size-5` · `top-1 left-1`)는 스페이싱 스케일 안의 값이다 (DESIGN.md §4).
      */}
      {ordinal !== undefined && (
        <span
          aria-hidden
          className="bg-bg text-fg border-border-strong text-caption absolute top-1 left-1 inline-flex size-5 items-center justify-center rounded-full border font-bold tabular-nums"
        >
          {ordinal}
        </span>
      )}
    </div>
  )
}
