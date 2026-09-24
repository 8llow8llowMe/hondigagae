import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { RegionalWeatherSkeleton } from '@/features/home/regional-weather-section'
import { SuitabilityListSkeleton } from '@/features/home/suitability-list-skeleton'
import { WalkTimesSkeleton } from '@/features/insight/walk-times-section'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 홈 최초 진입 로딩 (#907).
 *
 * **홈은 `(home)` 그룹 안이다.** `loading.tsx` 는 자기 세그먼트와 **모든 하위 세그먼트**를
 * Suspense 로 감싸므로 `(main)/loading.tsx` 로 두면 `plans/[planId]` 처럼 `notFound()` 를
 * 던지는 화면까지 덮어 soft 404 가 된다 (`architecture-guide.md` §7). 그룹으로 스코프를
 * 좁히면 URL 은 `/` 그대로고 감싸는 것은 홈 하나뿐이다 — `places/(list)` 와 같은 처방이다.
 *
 * **홈은 서버에서 실제로 기다린다.** `page.tsx` 가 세션을 읽고 장소·일정 두 조회를
 * `await` 하므로, 이 파일이 없으면 탭바에서 홈을 누른 뒤 응답이 올 때까지 이전 화면이
 * 그대로 서 있다 — 사용성 검토(#905 §6)에서 "이동 중 아무 반응이 없다" 로 잡힌 자리다.
 *
 * ### 흉내 내는 것은 "폴백이 풀린 직후의 홈" 이다
 *
 * 폴백이 풀리면 서버가 그린 `HomeView` 로 바뀌는데, **그 순간 판정·골든타임·권역·적합도는
 * 전부 클라이언트에서 아직 대기 중**이다(기준 장소·반려견이 브라우저 `localStorage` 에
 * 있어 서버가 key 를 모른다 — `page.tsx` 머리주석). 그래서 이 골격은 완성된 홈이 아니라
 * **그 대기 모양**을 그린다. 셋은 실화면의 골격을 **그대로 임포트한다** — 두 벌로 두면
 * 폴백이 풀리는 순간 카드 높이가 갈린다:
 *
 * - 골든타임 — `WalkTimesSkeleton`
 * - 권역 비교 — `RegionalWeatherSkeleton` (제목 없는 카드다. 제목은 응답과 함께 선다)
 * - 맞는 곳 목록 — `SuitabilityListSkeleton` (한 열 두 행)
 *
 * 판정 자리는 `HomeView` 의 `walkSafety.isPending` 골격과 같은 값(`h-7 w-40` + `h-5 w-56`)
 * 이다. 짧은 인라인 골격이라 파일로 뽑지 않았다.
 *
 * **날짜 줄은 선다.** 판정이 오기 전(`verdictShown` 이 거짓)에는 판정 카드 맨 위에
 * `todayLabel` 캡션이 서고, 판정이 오면 그 안으로 들어간다. 폴백이 풀린 직후는 앞쪽이다.
 * 날짜는 서버가 정하는 값이라(`page.tsx`) 여기서 지어내지 않고 자리만 잡는다.
 *
 * **프로필은 "로그인 + 반려견" 모양이다.** 실화면은 세 갈래(게스트 `py-4` + 버튼 · 로그인
 * 반려견 없음 · 로그인 반려견 있음 `py-10` + hero 아바타)인데 `loading.tsx` 는 세션을
 * 모른다. 폴백이 서는 것은 대부분 **탭바·헤더로 홈에 돌아오는 클라이언트 전환**이고, 그것을
 * 하는 것은 쓰고 있는 사용자라 가장 흔한 갈래를 고른다. 게스트는 그만큼 카드가 줄어든다.
 *
 * **기상특보 띠는 그리지 않는다.** 특보는 클라이언트 조회 뒤에야 뜨므로 폴백이 없던
 * 때에도 같은 자리에서 밀렸다 — 이 파일이 만든 점프가 아니다.
 *
 * **실화면과 같은 층·같은 자리로 그린다** (#475). `HomeView` 는 `Canvas` 위에
 * `rail-layout` 2단이고, 좌측 sticky 레일의 클래스를 같은 자리에 건다 — 어긋나면 lg 에서
 * 폴백이 풀리는 순간 좌측 열이 위로 뛴다 (`route-state-surface.test.ts` 가 쌍으로 잠근다).
 */
export default function HomeLoading() {
  return (
    <Canvas as="main" id="main-content">
      <h1 className="sr-only">혼디가개 홈</h1>

      <div className="rail-layout">
        <SurfaceStack className="lg:sticky lg:top-16 lg:self-start lg:pr-3">
          <Surface aria-busy>
            {/* 날짜 줄 — `text-caption` 한 줄(18) */}
            <div aria-hidden className={cn('pt-4', INSET_CLASS.card)}>
              <Skeleton className="h-4.5 w-44" />
            </div>

            {/* 프로필 — `ProfileCard` 의 로그인 + 반려견 갈래(`py-10` · hero 아바타) */}
            <div aria-hidden className={cn('flex items-center gap-4 py-10', INSET_CLASS.card)}>
              <Skeleton className="size-24 shrink-0 rounded-full md:size-28" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-40" />
              </div>
            </div>

            {/* 판정 — `HomeView` 의 `walkSafety.isPending` 골격과 같은 값 */}
            <div aria-hidden className={cn('border-border border-t py-4', INSET_CLASS.card)}>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="mt-2 h-5 w-56" />
            </div>

            <WalkTimesSkeleton />
          </Surface>

          {/* 배너 셋(AI 일정 · 제주올레 · 병원·약국) — `Banner` 는 `py-4` + 간격 없는 제목·설명 두 줄 */}
          {Array.from({ length: 3 }, (_, index) => (
            <Surface key={index} aria-busy>
              <div aria-hidden className={cn('flex flex-col py-4', INSET_CLASS.card)}>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4.5 w-56" />
              </div>
            </Surface>
          ))}
        </SurfaceStack>

        <SurfaceStack className="lg:pl-3">
          <RegionalWeatherSkeleton />

          {/* 맞는 곳 — 제목은 반려견 이름이 있어야 정해지므로 자리만 비운다 */}
          <Surface
            lead
            title={<Skeleton className="h-7 w-48 md:h-9 md:w-64" />}
            description={<Skeleton className="hidden h-4.5 w-40 md:block" />}
            /* `장소 찾기` 버튼 자리 — md 이상에서만 선다 */
            trailing={<Skeleton className="hidden h-11 w-24 shrink-0 md:block" />}
            aria-busy
          >
            <SuitabilityListSkeleton />
          </Surface>
        </SurfaceStack>
      </div>
    </Canvas>
  )
}
