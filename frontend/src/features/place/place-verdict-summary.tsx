import { ChevronRightIcon } from '@/components/icons'
import { Skeleton } from '@/components/skeleton'
import {
  type VerdictSummaryLine,
  verdictSummaryLines,
} from '@/features/place/place-verdict-summary-lines'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlaceCongestionResponse, WalkSafetyResponse } from '@/types/insight'
import type { PlaceDetail } from '@/types/place'

/**
 * 장소 상세 판정 요약 3줄 — 제목 카드 안, 태그 줄 아래 (#650 · 진단 D-1).
 *
 * 정본: `docs/features/place/장소상세-판정요약-세부명세.md`.
 *
 * **왜 있나.** 390×844 실측에서 동반은 1797px, 산책 판정은 1519px 아래였다 — 이름을 읽은
 * 사람이 "데려가도 되나 · 지금 나가도 되나" 를 보려면 1.8~2.1 화면을 굴려야 했다. 데스크톱은
 * 좌측 레일(`rail-detail-aside`)이 판정을 위로 올려 주지만 **모바일은 레일이 본문 뒤로
 * 흐른다.**
 *
 * **`lg:hidden` 이다.** ≥1024 는 그 레일이 적합도·산책을 이미 첫 화면에 세우고 혼잡도는
 * 본문 맨 위에 있어, 요약을 또 그리면 같은 답이 한 화면에 두 번 선다. `display:none` 이라
 * 스크린리더에서도 사라진다 — **DOM 을 폭마다 나누지 않는다**는 이 화면의 규칙
 * (`globals.css` `.rail-layout-detail` 주석)을 지키면서 중복만 없앤다.
 *
 * **새 카드를 만들지 않는다.** 이 세 줄은 "이 장소가 무엇인가" 의 답이라 이름과 한 몸이다.
 * 카드를 쪼개면 §0("카드 경계는 이야기 단위")에서 이름과 답이 다른 이야기가 된다. 판정
 * 카드가 적합도·산책을 1px 선으로만 잇는 것과 같은 장치를 쓴다.
 */
export function PlaceVerdictSummary({
  place,
  walkSafety,
  congestion,
}: {
  place: PlaceDetail
  walkSafety: { data: WalkSafetyResponse | null; loading: boolean; failed: boolean }
  congestion: { data: PlaceCongestionResponse | null; loading: boolean; failed: boolean }
}) {
  const lines = verdictSummaryLines(place, walkSafety, congestion)

  return (
    /*
      구분선은 카드 폭 전체를 가로지른다 — 인셋 밖이다. 안쪽 글줄만 `INSET_CLASS.card` 를
      받아 위 태그 줄과 같은 세로선에 선다.
    */
    <div className="border-border border-t lg:hidden">
      {/*
        **`ul` 이다.** 세 줄은 목록이다 — 한 문장으로 이으면 스크린리더가 세 답을 한 덩어리로
        읽는다 (`/about` 출처 목록과 같은 근거).

        **이름은 `aria-label` 로 준다.** 제목(`h2`)을 새로 만들면 `h1` 바로 아래에 붙어
        카드 제목 위계가 흔들린다 — 이 카드의 이름은 이미 `h1` 이다.
      */}
      <ul aria-label={messages.place.detailSummaryLabel} className={INSET_CLASS.card}>
        {lines.map((line, index) => (
          <li key={line.label} className={cn(index > 0 && 'border-border border-t')}>
            <SummaryRow line={line} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * 한 줄.
 *
 * **값이 없으면(조회 중) 링크로 만들지 않는다** — 갈 곳은 있지만 아직 할 말이 없다. 자리는
 * 지킨다: 로딩에 줄을 지우면 값이 올 때 아래가 통째로 밀린다.
 *
 * 접근 이름은 **라벨 + 값**이 이어 읽힌다 (`동반, 정보 없음 · 방문 전 확인해요`). 값만
 * 읽히면 무엇의 답인지 알 수 없다.
 */
function SummaryRow({ line }: { line: VerdictSummaryLine }) {
  /* 44px — 모바일 최소 터치 영역 (DESIGN.md §7) */
  const row = 'flex min-h-11 items-center gap-3 py-2'
  const label = (
    <span className="text-caption text-fg-muted w-20 shrink-0 font-semibold">{line.label}</span>
  )

  if (line.value === null) {
    return (
      <div className={row} aria-busy>
        {label}
        <Skeleton variant="text" className="h-5 w-32" />
      </div>
    )
  }

  return (
    /*
      같은 문서 안 이동이라 `next/link` 를 쓰지 않는다 — 라우팅이 아니다.
      대상에는 `scroll-mt-20` 이 있다(헤더가 `sticky top-0 h-14`). 약관 목차가 같은 이유로
      같은 값을 쓴다 (`legal-document-view.tsx`).
    */
    <a
      href={`#${line.anchorId}`}
      className={cn(
        row,
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
      )}
    >
      {label}
      <span className="text-body-2 text-fg min-w-0 flex-1 font-semibold break-keep">
        {line.value}
      </span>
      <ChevronRightIcon size={16} aria-hidden className="text-fg-subtle shrink-0" />
    </a>
  )
}
