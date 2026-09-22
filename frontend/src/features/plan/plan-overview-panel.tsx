import { ChevronRightIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { PetAvatar } from '@/components/pet-avatar'
import { Skeleton } from '@/components/skeleton'
import { Surface } from '@/components/surface'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { PlanStatusBadge } from '@/features/plan/plan-status-badge'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { formatPlanDateRangeCompact, planPhaseOf } from '@/lib/plan/date'
import { planPhaseLabel, planPhaseNote } from '@/lib/plan/phase-text'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { Pet } from '@/types/pet'
import type { PlanDayWeatherItem, PlanDetail } from '@/types/plan'

/**
 * 좌 레일 — 제목 · 상태 · 기간 · D-day · 반려견 · 일자별 판정 목차 (아트보드 02).
 *
 * 모바일에서는 레일이 아니라 화면 맨 위의 개요 블록이다. **DOM 순서가 모바일 기준
 * 그대로여도 두 레이아웃이 성립하므로** `.rail-layout-detail` 변형을 쓰지 않는다 (D1).
 *
 * **두 조각을 돌려준다** (`DESIGN.md §0`, #447 · #553 · #732) — 부모 `SurfaceStack` 의
 * 직접 자식이 되어야 카드 간격을 받기 때문에 fragment 다.
 * 1. **제목 줄도 카드다** (#553). 동행 반려견도 여기 든다: "누구와 가는 일정인가" 는
 *    신원의 일부다. **`D-N` + 일자별 판정 목차도 이 카드 안이다** (#732).
 * 2. **확정 액션** (`action` 슬롯) — 카드가 아니라 바닥 위에 선다. 출발 전에는 비기도
 *    한다 (`planStatusActionLayout`).
 *
 * ### 카드 안이 세 구획이다 (#841)
 *
 * 예전에는 일곱 줄이 `gap-2` 로 **균등하게** 쌓여 있었다. 그러면 이 카드가 답해야 하는
 * 질문(`언제 떠나나`)의 답인 `D-3` 이 네 번째 줄에서 날짜 줄과 같은 무게로 서고, 어느
 * 줄이 신원이고 어느 줄이 상태인지도 간격만으로는 갈리지 않는다. 그래서 1px 선으로
 * 구획을 나눈다.
 *
 * | 구획 | 담는 것 | 답하는 질문 |
 * |------|---------|-------------|
 * | 1 신원 | 상태 배지 · 제목 · 동행견 | 무슨 일정인가 |
 * | 2 상태 | `D-3` · 기간 · 총 일수 · 예산 | 언제 떠나나 |
 * | 3 목차 | 일자별 적합도 앵커 | 어느 날이 좋은가 |
 *
 * **구획 2 의 머리는 `D-3` 이다.** 날짜 줄은 그 아래 캡션으로 내린다 — 남은 일수를 먼저
 * 읽고 나서 언제인지를 확인하는 순서지, 그 반대가 아니다.
 *
 * **목차 카드를 다시 만들지 않는다.** #732 가 걷어낸 것은 `hidden lg:block` **카드**였지
 * 세로 레이아웃 자체가 아니었다 — 카드를 만들지 않고 개요 카드 **안**에 1px 선으로
 * 구획을 만들면 모든 폭에서 서므로 그 결정이 그대로 지켜진다 (`PlanVerdictToc`).
 *
 * ### 제목 줄이 카드가 된 이유 (#553)
 *
 * #447 은 장소 상세(#443)를 따라 "페이지 머리(h1)는 카드가 아니다" 로 두었다. 그런데 이
 * 화면의 제목 줄은 **제목만이 아니다** — 상태 배지 · 기간 · 예산 · D-day · 동행 반려견까지
 * 담은 개요다. §0 의 카드 판정 3문에 그대로 걸린다: ① 자기 제목(일정 이름)이 있고,
 * ② 혼자 떼어놔도 "무슨 일정인가" 로 읽히며, ③ 담는 항목이 둘 이상이다.
 *
 * 카드가 아니던 동안에는 바로 아래 `준비물` · `병원` 카드와 **왼쪽 세로선은 같은데
 * 테두리만 없어서**, 회색 바닥 위에 글자가 떠 있고 그 아래로 카드가 시작되는 모양이었다.
 *
 * **장소 상세는 그대로 둔다.** 거기 페이지 머리는 제목 + 한 줄 메타라 ③ 에 걸린다.
 */
export function PlanOverviewPanel({
  plan,
  companions,
  petPending,
  today,
  verdicts,
  menu = null,
  action = null,
}: {
  plan: PlanDetail
  /** 조회 실패·삭제된 반려견이면 `null` — **카드만 빠지고 화면은 그대로다** (D5) */
  /** 동행 반려견, `petIds` 순서 (#218). 못 찾은 아이는 빠진다 */
  companions: readonly Pet[]
  petPending: boolean
  today: Date
  /** 판정. 아직 없거나 실패했으면 빈 배열 — 목차 자체를 렌더하지 않는다 */
  verdicts: PlanDayWeatherItem[]
  /**
   * 일정 관리 진입점(`PlanManageMenu`). **주입으로 받는다** — 이 패널은 'use client' 가
   * 없는 표시 전용이고, 메뉴는 상태·라우팅·삭제 요청을 갖는 클라이언트 컴포넌트다.
   * 여기서 직접 import 하면 패널 전체가 클라이언트로 넘어가고 렌더 테스트도 무거워진다.
   */
  menu?: React.ReactNode
  /**
   * 확정 액션(`PlanStatusAction`) — 개요 카드 **바로 아래**에 선다 (이슈 #553).
   *
   * **자리를 슬롯으로 받는 이유**는 그것이 개요와 목차 사이여야 하기 때문이다. 호출부에서
   * `<PlanOverviewPanel />` 뒤에 그냥 두면 이 컴포넌트가 fragment 라 **목차 카드 뒤**로
   * 내려간다 — 데스크톱에서 확정 버튼이 일자 목차 아래로 밀린다.
   *
   * `menu` 와 같은 이유로 주입이다 — 액션은 상태·요청을 갖는 클라이언트 컴포넌트다.
   */
  action?: React.ReactNode
}) {
  /*
    **여기만 `여행 중` 이 아니라 `오늘 4일차` 를 쓴다.** 이 줄은 배지 기둥이 아니라 설명
    줄이고, 바로 아래에 `총 4일` 이 서 있어 며칠째인지가 붙어야 두 값이 서로를 설명한다.
    목록·홈과 어긋난 말이 아니라 **같은 판정에서 나온 더 자세한 말**이다.
  */
  const phase = planPhaseOf(plan.startDate, plan.endDate, today)
  const phaseText = planPhaseNote(phase) ?? planPhaseLabel(phase)

  return (
    /*
      **여기에 `lg:sticky` 를 걸지 않는다.** 이 패널은 좌측 레일의 **첫 블록**일 뿐이고
      아래에 준비물·병원 배너가 이어진다. 이것만 고정하면 레일이 스크롤될 때 이 패널은
      제자리에 붙어 있고 **뒤 형제들이 그 위로 올라와 글자가 겹친다** — 실측으로
      scrollY=700 에서 패널이 top 64~519 에 못 박힌 채 준비물이 -181 까지 올라갔다.

      고정은 레일 전체(`aside`)가 맡는다 (`plan-detail-section.tsx`). 홈이 좌측 레일을
      한 겹으로 감싸 고정하는 것과 같은 형태다.
    */
    <>
      {/*
        **카드가 `title` 슬롯을 쓰지 않는다.** 그 슬롯은 `h2` 를 그리는데 여기 제목은
        페이지의 `h1` 이고, 상태 배지·관리 메뉴가 그 위 줄에 선다. `aria-label` 도 주지
        않는다 — 안의 `h1` 이 이미 이 묶음의 이름이라 접근성 이름이 둘이 된다
        (`Surface` 머리주석).
      */}
      <Surface>
        <div className={cn('flex flex-col gap-4 py-4 md:py-5', INSET_CLASS.card)}>
          {/* ── 구획 1: 신원 — 상태 · 제목 · 동행견 */}
          <div className="flex flex-col gap-2">
            {/*
              **`초안` 배지가 제목 줄을 떠났다** (#841). 제목이 2~3줄로 접힐 때 배지가
              제목 첫 줄 옆에 붙어 있어 x 위치가 제목 길이를 따라 흔들렸다. eyebrow 줄로
              올리면 `h1` 이 자기 줄을 온전히 쓴다.
            */}
            <div className="flex items-center gap-2">
              <PlanStatusBadge status={plan.status} />
              {menu !== null && <div className="ml-auto">{menu}</div>}
            </div>

            {/*
              제목은 서버 상한 60자다. 좌측 400 에서 2~3줄이 되므로 keep-all 로 어절을 지킨다.

              **`lg:text-display` 는 저장소의 콘텐츠 화면 `h1` 관례다** (#358) — 일정 목록 ·
              장소 추가 · 일차 재생성 · 장소 상세가 같은 값이다.
            */}
            <h1 className="text-title-1 text-fg lg:text-display font-bold break-keep lg:font-extrabold">
              {plan.title}
            </h1>

            <PlanPetCard companions={companions} pending={petPending} />
          </div>

          {/* ── 구획 2: 상태 — D-day 가 이 카드의 헤드라인이다 (#841) */}
          <div className="border-border flex flex-col gap-1 border-t pt-4">
            {phaseText !== null && (
              <p className="text-title-1 text-fg font-bold tabular-nums">{phaseText}</p>
            )}

            <p className="text-caption text-fg-muted flex flex-wrap gap-x-2 font-medium tabular-nums">
              <span>{formatPlanDateRangeCompact(plan.startDate, plan.endDate, today)}</span>
              <span aria-hidden>·</span>
              <span>{messages.plan.totalDays.replace('{days}', String(plan.totalDays))}</span>
              {/*
                **예산이 없으면 줄이 아예 없다** (#841). `예산 미정` 은 사실이 아니라 빈
                상태이고, 액션으로 이어지지 않는 빈 상태를 사실처럼 적으면 잡음만 남는다.
              */}
              {plan.budget !== null && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {messages.plan.budgetLabel}{' '}
                    {messages.plan.budgetAmount.replace(
                      '{amount}',
                      plan.budget.toLocaleString('ko-KR'),
                    )}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* ── 구획 3: 일자별 적합도 목차 */}
          <PlanVerdictToc verdicts={verdicts} />
        </div>
      </Surface>

      {action}
    </>
  )
}

/**
 * 동행 반려견. **조회 실패는 숨김이다** — 카드만 빠지고 오류를 말하지 않는다 (D5).
 *
 * **한 마리면 한 줄이다** (#841). #218 이 전원 나열을 요구한 근거는 "일자 판정이
 * `verdictBasisPet` 으로 부르는 이름이 반드시 이 카드 안에 있어야 한다" 인데, **한 마리면
 * `basisPetName` 이 `null` 이라 일자 카드가 이름을 부르지 않는다** (`plan-day-verdict.tsx`
 * 의 `basisPetName` JSDoc). 그 요구는 여러 마리일 때만 생기므로, 여러 마리는 전원을 한
 * 줄씩 그대로 세운다 — 최대 5마리라 길어지지 않는다.
 */
function PlanPetCard({ companions, pending }: { companions: readonly Pet[]; pending: boolean }) {
  if (pending) return <Skeleton className="h-7 w-40" />
  if (companions.length === 0) return null

  if (companions.length === 1) {
    const pet = companions[0] as Pet
    const traits = [pet.breed, pet.sizeType.name].filter(
      (part): part is string => part !== null && part.length > 0,
    )

    return (
      <div className="flex items-center gap-2">
        <PetAvatar name={pet.name} size="md" />
        {/* 한 줄이라 `·` 로 잇는다 — 특성끼리는 공백이다, 구분자가 두 층이면 어디가 경계인지 갈리지 않는다 */}
        <p className="text-caption text-fg-muted min-w-0 truncate font-medium">
          <span className="text-fg font-semibold">{pet.name}</span>
          {traits.length > 0 && ` · ${traits.join(' ')}`}
        </p>
      </div>
    )
  }

  return (
    // 카드 안이라 선을 긋지 않는다 — 구획 1 안쪽이고 경계는 아래 구획선이 갖는다 (#447 · #553)
    <div className="flex flex-col gap-3 pt-1">
      {companions.map((pet) => (
        <PlanPetRow key={pet.petId} pet={pet} />
      ))}
    </div>
  )
}

function PlanPetRow({ pet }: { pet: Pet }) {
  const traits = [pet.breed, pet.sizeType.name].filter(
    (part): part is string => part !== null && part.length > 0,
  )

  return (
    <div className="flex items-center gap-3">
      <PetAvatar name={pet.name} size="lg" />
      <div className="min-w-0">
        <p className="text-body-1 text-fg font-semibold break-keep">{pet.name}</p>
        {traits.length > 0 && (
          <p className="text-caption text-fg-muted mt-1 line-clamp-1 font-medium">
            {traits.join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * 목차에 세우는 일자 수의 상한 (#732 · #841).
 *
 * **세로 목록으로 돌아오면서 4 → 7 이 됐다.** 가로 wrap 이던 동안에는 390 에서 두 줄에
 * 넷이 상한이었다. 세로는 줄당 44px 이라 일곱이면 308px 이고, 그 이상은 요약이 아니라
 * 목록이 된다. **여행은 최대 30일이다** (`PLAN_PERIOD_MAX_DAYS`) — 넘치는 일자는 개수로만
 * 말하고 판정 자체는 아래 일자 카드가 그대로 갖는다.
 *
 * **이름을 바꾸지 않는다** — 값만 바뀌었고 다른 곳이 이 export 를 참조한다.
 */
export const PLAN_VERDICT_STRIP_MAX_DAYS = 7

/**
 * 목차 섹션 머리의 `id` — `nav aria-labelledby` 가 가리킨다.
 *
 * **고정 문자열이어도 안전하다** — 이 패널은 한 화면에 하나만 선다 (좌 레일의 첫 블록).
 */
const PLAN_VERDICT_TOC_TITLE_ID = 'plan-verdict-toc-title'

/**
 * 일자별 적합도 목차 (#732 · #841).
 *
 * ## 세로로 돌아왔다
 *
 * #732 는 데스크톱 전용 목차 **카드**를 걷어내고 가로 한 줄로 접었다. 걷어낼 이유였던 것은
 * `hidden lg:block` 이었지 **세로 레이아웃 자체가 아니었다** — 카드를 만들지 않고 개요 카드
 * 안에 두면 모든 폭에서 서므로 그 결정이 지켜진다.
 *
 * 가로 wrap 이 잃고 있던 것 셋: ① `D-N` 과 같은 줄이라 wrap 되면 마지막 일자가 고아 행이
 * 됐고 ② 앵커라는 신호(`›`)가 없어 누르는 것인 줄 몰랐고 ③ 배지마다 축 라벨이 붙어
 * `적합도` 가 한 카드에서 세 번 섰다.
 *
 * **축 라벨은 섹션 머리가 한 번만 갖는다.** 그래서 배지에 `axis` 를 주지 않는다 — #652 의
 * 요구("혼잡도의 `보통` 과 구분")를 섹션 머리(`일자별 적합도`)가 충족한다. **일자 카드의
 * 배지는 그대로 `axis` 를 단다** — 거기에는 이 섹션 머리가 없다.
 *
 * **`aria-label` 이 아니라 `aria-labelledby` 다.** 예전에는 보이는 제목이 없어서
 * `aria-label` 이 이 묶음의 유일한 이름이었는데, 같은 문구의 `<p>` 를 세우면 랜드마크에
 * 진입할 때 이름으로 한 번 · 문단으로 또 한 번 읽힌다. 보이는 글자를 가리키면 **보이는
 * 글자와 읽히는 글자가 갈릴 자리가 없다** (`등급배지-축라벨-세부명세.md` D6 이 축 접두어에
 * `aria-hidden` 을 주지 않기로 한 것과 같은 논리다).
 */
function PlanVerdictToc({ verdicts }: { verdicts: PlanDayWeatherItem[] }) {
  if (verdicts.length === 0) return null

  const shown = verdicts.slice(0, PLAN_VERDICT_STRIP_MAX_DAYS)
  const hidden = verdicts.length - shown.length

  return (
    <nav aria-labelledby={PLAN_VERDICT_TOC_TITLE_ID} className="border-border border-t pt-4">
      <p id={PLAN_VERDICT_TOC_TITLE_ID} className="text-caption text-fg-muted mb-1 font-medium">
        {messages.plan.verdictTocTitle}
      </p>

      {/* 줄 사이 선은 저장소 공통 패턴이다 — `ul` 이 갖고 첫 줄은 받지 않는다 */}
      <ul className="[&>li+li]:border-border flex flex-col [&>li+li]:border-t">
        {shown.map((verdict) => (
          <li key={verdict.day}>
            {/* 44px 터치 영역 (D6) */}
            <a
              href={`#${planDayAnchorId(verdict.day)}`}
              className="focus-visible:ring-brand-500 hover:bg-band flex min-h-11 items-center gap-2 focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-body-2 text-fg font-medium tabular-nums">
                {messages.plan.dayLabel.replace('{day}', String(verdict.day))}
              </span>

              <span className="ml-auto">
                {verdict.suitabilityLevel === null ? (
                  // 판정을 못 낸 날을 낮은 등급으로 칠하지 않는다 — 점선 unknown 이다
                  <MetricBadge tone="unknown" size="sm">
                    {messages.plan.verdictTocUnavailable}
                  </MetricBadge>
                ) : (
                  <MetricBadge tone={suitabilityTone(verdict.suitabilityLevel.code)} size="sm">
                    {verdict.suitabilityLevel.name}
                  </MetricBadge>
                )}
              </span>

              <ChevronRightIcon size={16} className="text-fg-subtle shrink-0" aria-hidden />
            </a>
          </li>
        ))}
      </ul>

      {/* 남은 일자를 없는 척하지 않는다 — 판정 자체는 아래 일자 카드가 그대로 갖는다 */}
      {hidden > 0 && (
        <p className="text-caption text-fg-muted mt-2 font-medium tabular-nums">
          {messages.plan.verdictStripMore.replace('{count}', String(hidden))}
        </p>
      )}
    </nav>
  )
}
