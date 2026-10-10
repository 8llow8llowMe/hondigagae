package com.hondigagae.domainlayer.planner.application.service.worker;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

/**
 * 선택 조회 여러 번을 차례로 부르되, <b>첫 실패에서 멈추고 벽시계 예산을 넘으면 더 부르지 않는다</b> (#1312).
 *
 * <p>권역 거리순 조회는 잡 하나에 18번이다. tour-service 가 느려지거나 끊긴 채 18번을 다 부르면 잡 최악값이 내부 조회
 * 18 × 5초만큼 늘어 타임아웃 산술이 깨지고, 그 호출들이 혼자 서킷을 열어 같은 잡의 필수 포함 조회까지
 * {@code CallNotPermitted} 로 실패시킨다. 그래서 실패 한 번이면 나머지를 건너뛰고(서킷에 실패를 더 쌓지 않는다),
 * 정상이어도 누적 시간이 예산을 넘으면 그 뒤를 부르지 않는다. 예산은 호출을 <b>시작하기 전</b>에만 보므로, 최악 소요는
 * "예산 + 진행 중이던 호출 하나의 timeout" 이다.
 */
final class BudgetedLookups {

    /** 왜 멈췄는가. */
    enum Stop {
        /** 모두 불렀다. */
        NONE,
        /** 한 조회가 실패해 나머지를 건너뛰었다. */
        FAILED,
        /** 누적 시간이 예산을 넘어 나머지를 건너뛰었다. */
        BUDGET
    }

    /**
     * @param results 부른 조회의 결과. 들어온 순서대로이고, 멈춘 지점 뒤는 없다 — 크기가 곧 부른(성공한) 수다
     * @param failure {@link Stop#FAILED} 일 때의 예외
     */
    record Outcome<T>(List<List<T>> results, Stop stop, AiPlanException failure) {
    }

    private BudgetedLookups() {
    }

    static <T> Outcome<T> run(List<Supplier<List<T>>> lookups, long budgetNanos, LongSupplier nanoClock) {
        long startedAt = nanoClock.getAsLong();
        List<List<T>> results = new ArrayList<>(lookups.size());
        for (Supplier<List<T>> lookup : lookups) {
            if (nanoClock.getAsLong() - startedAt >= budgetNanos) {
                return new Outcome<>(List.copyOf(results), Stop.BUDGET, null);
            }
            try {
                List<T> found = lookup.get();
                results.add(found == null ? List.of() : found);
            } catch (AiPlanException exception) {
                return new Outcome<>(List.copyOf(results), Stop.FAILED, exception);
            }
        }
        return new Outcome<>(List.copyOf(results), Stop.NONE, null);
    }
}
