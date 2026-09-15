import { MetricBadge } from '@/components/metric'
import { PetAvatar } from '@/components/pet-avatar'
import { Skeleton } from '@/components/skeleton'
import { Surface, SurfaceList } from '@/components/surface'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { PlanStatusBadge } from '@/features/plan/plan-status-badge'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { formatPlanDateRange, planPhaseOf } from '@/lib/plan/date'
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
 * **세 조각을 돌려준다** (`DESIGN.md §0`, #447 · #553) — 부모 `SurfaceStack` 의 직접
 * 자식이 되어야 카드 간격을 받기 때문에 fragment 다.
 * 1. **제목 줄도 카드다** (#553). 동행 반려견도 여기 든다: "누구와 가는 일정인가" 는
 *    신원의 일부다.
 * 2. **확정 액션** (`action` 슬롯) — 카드가 아니라 바닥 위에 선다.
 * 3. **일자별 판정 목차는 카드다** — 자기 제목이 있고 항목이 여럿인 목록. 데스크톱 전용.
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
    줄이고, 바로 왼쪽에 `총 4일` 이 서 있어 며칠째인지가 붙어야 두 값이 서로를 설명한다.
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
        페이지의 `h1` 이고, 상태 배지·관리 메뉴가 같은 줄에 선다. `aria-label` 도 주지
        않는다 — 안의 `h1` 이 이미 이 묶음의 이름이라 접근성 이름이 둘이 된다
        (`Surface` 머리주석).
      */}
      <Surface>
        <div className={cn('flex flex-col gap-5 py-4 md:py-5', INSET_CLASS.card)}>
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              {/*
            제목은 서버 상한 60자다. 좌측 400 에서 2~3줄이 되므로 keep-all 로 어절을 지킨다.

            **`lg:text-display` 는 저장소의 콘텐츠 화면 `h1` 관례다** (#358) — 일정 목록 ·
            장소 추가 · 일차 재생성 · 장소 상세가 같은 값이다. 여기만 인증 폼 값
            (`text-title-1 font-bold`)을 쓰고 있어서, 화면 제목이 우측 `N일차`(22/700)와
            **모든 폭에서 완전히 같았다.** 그래서 좌측 레일의 준비물도 올릴 자리가 없었다.
          */}
              <h1 className="text-title-1 text-fg lg:text-display min-w-0 flex-1 font-bold break-keep lg:font-extrabold">
                {plan.title}
              </h1>
              <PlanStatusBadge status={plan.status} className="mt-1" />
              {/* 제목 줄 우측 상단 — 아이콘 버튼의 히트 영역이 제목 첫 줄과 맞도록 `-mt-1` */}
              {menu !== null && <div className="-mt-1">{menu}</div>}
            </div>

            <p className="text-body-2 text-fg-muted font-medium tabular-nums">
              {formatPlanDateRange(plan.startDate, plan.endDate)}
            </p>

            <p className="text-caption text-fg-muted flex flex-wrap gap-x-2 font-medium tabular-nums">
              <span>{messages.plan.totalDays.replace('{days}', String(plan.totalDays))}</span>
              <span aria-hidden>·</span>
              <span>
                {plan.budget === null
                  ? messages.plan.budgetEmpty
                  : `${messages.plan.budgetLabel} ${messages.plan.budgetAmount.replace(
                      '{amount}',
                      plan.budget.toLocaleString('ko-KR'),
                    )}`}
              </span>
              {phaseText !== null && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-fg font-bold">{phaseText}</span>
                </>
              )}
            </p>
          </div>

          <PlanPetCard companions={companions} pending={petPending} />
        </div>
      </Surface>

      {action}

      <PlanVerdictToc verdicts={verdicts} />
    </>
  )
}

/**
 * 동행 반려견 카드. **조회 실패는 숨김이다** — 카드만 빠지고 오류를 말하지 않는다 (D5).
 *
 * **전원을 한 줄씩 세운다** (#218). 목록 행은 `{대표} 외 N마리` 로 줄이지만 여기는 줄이지
 * 않는다 — 일자 판정이 `verdictBasisPet` 으로 부르는 이름이 **반드시 이 카드 안에 있어야**
 * 사용자가 "그 아이가 누구인지" 를 알 수 있다. 최대 5마리라 길어지지 않는다.
 */
function PlanPetCard({ companions, pending }: { companions: readonly Pet[]; pending: boolean }) {
  if (pending) return <Skeleton className="h-14 w-full" />
  if (companions.length === 0) return null

  return (
    // 카드 안이라 선을 긋지 않는다 — 제목 줄과의 간격(20)이 경계다 (#447 · #553)
    <div className="flex flex-col gap-3">
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
 * 일자별 판정 목차 — **데스크톱 전용**이다 (아트보드 02).
 *
 * 요약을 읽다가 그 날로 뛰는 앵커 링크 목록이고, 판정 색을 유지해 **목차이면서
 * 요약**이다. 각 줄 44px (D6).
 *
 * 모바일에서는 숨긴다 — 일자 섹션이 바로 아래에 이어져 목차가 중복이다.
 */
function PlanVerdictToc({ verdicts }: { verdicts: PlanDayWeatherItem[] }) {
  if (verdicts.length === 0) return null

  /*
    카드다 (#447). 제목은 `Surface` 의 `h2` 고 `nav` 는 그 안이다 — 카드가 곧 목차라 이름을
    두 번 붙이지 않는다(`nav` 의 `aria-label` 은 목차 자체의 랜드마크 이름). 줄은 카드 안
    L2 규약 — 위 1px 선으로 제목과 갈리고 사이는 `SurfaceList` 가 긋는다.
  */
  return (
    <Surface title={messages.plan.verdictTocTitle} className="hidden lg:block">
      <nav aria-label={messages.plan.verdictTocTitle}>
        <SurfaceList className="border-border border-t">
          {verdicts.map((verdict) => (
            <li key={verdict.day} className={INSET_CLASS.card}>
              <a
                href={`#${planDayAnchorId(verdict.day)}`}
                className="focus-visible:ring-brand-500 flex min-h-11 items-center justify-between gap-2 py-2 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="text-body-2 text-fg font-medium">
                  {messages.plan.dayLabel.replace('{day}', String(verdict.day))}
                </span>
                {verdict.suitabilityLevel === null ? (
                  // 판정을 못 낸 날을 낮은 등급으로 칠하지 않는다 — 점선 unknown 이다
                  <MetricBadge tone="unknown" size="sm" axis="suitability">
                    {messages.plan.verdictTocUnavailable}
                  </MetricBadge>
                ) : (
                  <MetricBadge
                    tone={suitabilityTone(verdict.suitabilityLevel.code)}
                    size="sm"
                    axis="suitability"
                  >
                    {verdict.suitabilityLevel.name}
                  </MetricBadge>
                )}
              </a>
            </li>
          ))}
        </SurfaceList>
      </nav>
    </Surface>
  )
}
