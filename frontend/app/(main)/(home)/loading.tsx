import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { RegionalWeatherSkeleton } from '@/features/home/regional-weather-section'
import { SuitabilityListSkeleton } from '@/features/home/suitability-list-skeleton'
import { WalkVerdictSkeleton } from '@/features/home/walk-verdict-skeleton'
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
 * **그 대기 모양**을 그린다. 넷은 실화면의 골격을 **그대로 임포트한다** — 두 벌로 두면
 * 폴백이 풀리는 순간 카드 높이가 갈린다:
 *
 * - 골든타임 — `WalkTimesSkeleton`
 * - 권역 비교 — `RegionalWeatherSkeleton` (제목 없는 카드다. 제목은 응답과 함께 선다)
 * - 갈 만한 곳 — `SuitabilityListSkeleton` (사진 카드 두 장, #1069)
 *
 * - 판정 — `WalkVerdictSkeleton` (`HomeView` 의 `walkSafety.isPending` 과 같은 것)
 *
 * **날짜 줄은 판정 자리에 선다** — 프로필 **아래**다. 판정이 오면 날짜는 `WalkVerdict` 의
 * 등급 줄 바로 위 caption 이 되므로, 대기 중에도 그 자리에 세운다. 예전에는 카드 맨 위
 * (프로필 위)에 섰다가 판정이 오는 순간 아래로 내려앉았다. 날짜는 서버가 정하는 값이라
 * (`page.tsx`) 여기서 지어내지 않고 자리만 잡는다(`todayLabel={null}`).
 *
 * **프로필은 "로그인 + 반려견" 모양이다.** 실화면은 세 갈래(게스트 `py-4` + 버튼 · 로그인
 * 반려견 없음 · 로그인 반려견 있음 `py-10` + hero 아바타)인데 `loading.tsx` 는 세션을
 * 모른다. 폴백이 서는 것은 대부분 **탭바·헤더로 홈에 돌아오는 클라이언트 전환**이고, 그것을
 * 하는 것은 쓰고 있는 사용자라 가장 흔한 갈래를 고른다. 게스트는 그만큼 카드가 줄어든다.
 *
 * **기상특보 띠는 그리지 않는다.** 특보는 클라이언트 조회 뒤에야 뜨므로 폴백이 없던
 * 때에도 같은 자리에서 밀렸다 — 이 파일이 만든 점프가 아니다.
 *
 * **순서도 실화면과 같다** (#1356) — 좌측은 요약 카드 한 장, 우측은 갈 만한 곳 → 바로가기 →
 * 권역이다. 소개 카드 · 실내 · 일정은 조건부라 그리지 않는다.
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
            {/* 프로필 — `ProfileCard` 의 로그인 + 반려견 갈래(`py-10` · hero 아바타) */}
            <div aria-hidden className={cn('flex items-center gap-4 py-10', INSET_CLASS.card)}>
              <Skeleton className="size-24 shrink-0 rounded-full md:size-28" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-40" />
              </div>
            </div>

            {/* 판정 — 날짜 자리를 함께 잡는다 (위 머리주석) */}
            <WalkVerdictSkeleton todayLabel={null} />

            <WalkTimesSkeleton />
          </Surface>
        </SurfaceStack>

        <SurfaceStack className="lg:pl-3">
          {/* 맞는 곳 — 제목은 반려견 이름이 있어야 정해지므로 자리만 비운다 */}
          <Surface
            lead
            title={<Skeleton className="h-7 w-48 md:h-9 md:w-64" />}
            /* 제목 아래 줄이 없다 — `N곳` 개수 줄을 #1069 에서 걷었다 (`home-view.tsx`) */
            /* `장소 찾기` 자리 — 모바일은 글자 링크(#1356), md 이상은 버튼 */
            trailing={<Skeleton className="h-6 w-20 shrink-0 md:h-11 md:w-24" />}
            aria-busy
          >
            <SuitabilityListSkeleton />
          </Surface>

          {/*
            바로가기 한 줄 (#1356) — `HomeShortcuts` 의 세 칸(아이콘 24 · 이름 · 설명줄, `py-4`).
            예전 좌측 레일 끝의 배너 셋이 이 한 줄이 됐다.
          */}
          <Surface aria-busy>
            <div aria-hidden className="grid grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex flex-col items-center gap-1 px-2 py-4">
                  <Skeleton className="mb-1 size-6" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </Surface>

          {/* 권역 비교 — 우측 열의 끝이다 (#1356) */}
          <RegionalWeatherSkeleton />
        </SurfaceStack>
      </div>
    </Canvas>
  )
}
