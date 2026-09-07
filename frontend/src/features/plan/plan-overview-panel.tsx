import { MetricBadge } from '@/components/metric'
import { PetAvatar } from '@/components/pet-avatar'
import { Skeleton } from '@/components/skeleton'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { PlanStatusBadge } from '@/features/plan/plan-status-badge'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { daysUntil, formatPlanDateRange } from '@/lib/plan/date'
import type { Pet } from '@/types/pet'
import type { PlanDayWeatherItem, PlanDetail } from '@/types/plan'

/**
 * 좌 레일 — 제목 · 상태 · 기간 · D-day · 반려견 · 일자별 판정 목차 (아트보드 02).
 *
 * 모바일에서는 레일이 아니라 화면 맨 위의 개요 블록이다. **DOM 순서가 모바일 기준
 * 그대로여도 두 레이아웃이 성립하므로** `.rail-layout-detail` 변형을 쓰지 않는다 (D1).
 */
export function PlanOverviewPanel({
  plan,
  companions,
  petPending,
  today,
  verdicts,
  menu = null,
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
}) {
  const dday = daysUntil(plan.startDate, today)

  return (
    /*
      **여기에 `lg:sticky` 를 걸지 않는다.** 이 패널은 좌측 레일의 **첫 블록**일 뿐이고
      아래에 준비물·병원 배너가 이어진다. 이것만 고정하면 레일이 스크롤될 때 이 패널은
      제자리에 붙어 있고 **뒤 형제들이 그 위로 올라와 글자가 겹친다** — 실측으로
      scrollY=700 에서 패널이 top 64~519 에 못 박힌 채 준비물이 -181 까지 올라갔다.

      고정은 레일 전체(`aside`)가 맡는다 (`plan-detail-section.tsx`). 홈이 좌측 레일을
      한 겹으로 감싸 고정하는 것과 같은 형태다.
    */
    <div className="flex flex-col gap-5 px-4 py-6 md:px-10 lg:px-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          {/* 제목은 서버 상한 60자다. 좌측 400 에서 2~3줄이 되므로 keep-all 로 어절을 지킨다 */}
          <h1 className="text-title-1 text-fg min-w-0 flex-1 font-bold break-keep">{plan.title}</h1>
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
          {dday !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="text-fg font-bold">
                {dday === 0
                  ? messages.plan.ddayToday
                  : messages.plan.dday.replace('{days}', String(dday))}
              </span>
            </>
          )}
        </p>
      </div>

      <PlanPetCard companions={companions} pending={petPending} />

      <PlanVerdictToc verdicts={verdicts} />
    </div>
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
    <div className="border-border flex flex-col gap-3 border-t pt-4">
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
          <p className="text-caption text-fg-muted mt-0.5 line-clamp-1 font-medium">
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

  return (
    <nav aria-label={messages.plan.verdictTocTitle} className="hidden lg:block">
      <h2 className="text-caption text-fg-muted font-semibold">{messages.plan.verdictTocTitle}</h2>
      <ul className="border-border mt-2 border-t">
        {verdicts.map((verdict) => (
          <li key={verdict.day} className="border-border border-b">
            <a
              href={`#${planDayAnchorId(verdict.day)}`}
              className="focus-visible:ring-brand-500 flex min-h-11 items-center justify-between gap-2 py-2 focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-body-2 text-fg font-medium">
                {messages.plan.dayLabel.replace('{day}', String(verdict.day))}
              </span>
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
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
