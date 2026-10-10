package com.hondigagae.domainlayer.planner.application.service.worker;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 권역 거리순 조회의 조기 중단 · 시간 예산 (#1312). 잡 최악값 산술({@code AiPlanTaskExecutorTest})이 "예산 + 진행 중 호출
 * 하나" 를 전제로 하므로, 예산을 넘긴 뒤 새 호출을 시작하지 않는다는 것과 실패 뒤 더 부르지 않는다는 것을 지킨다.
 */
class BudgetedLookupsTest {

    private static final long BUDGET = Duration.ofSeconds(3).toNanos();

    private final List<Integer> called = new ArrayList<>();

    @Test
    @DisplayName("모두 성공하면 모두 부르고 결과를 순서대로 돌려준다")
    void runsAllWithinBudget() {
        BudgetedLookups.Outcome<String> outcome = BudgetedLookups.run(lookups(3, -1), BUDGET, () -> 0L);

        assertThat(outcome.stop()).isEqualTo(BudgetedLookups.Stop.NONE);
        assertThat(outcome.results()).containsExactly(List.of("0"), List.of("1"), List.of("2"));
        assertThat(called).containsExactly(0, 1, 2);
    }

    @Test
    @DisplayName("한 번 실패하면 남은 조회를 부르지 않는다 — 실패 앞의 결과는 남긴다")
    void stopsOnFirstFailure() {
        BudgetedLookups.Outcome<String> outcome = BudgetedLookups.run(lookups(5, 1), BUDGET, () -> 0L);

        assertThat(outcome.stop()).isEqualTo(BudgetedLookups.Stop.FAILED);
        assertThat(outcome.failure().getErrorCode()).isEqualTo(AiPlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        assertThat(outcome.results()).containsExactly(List.of("0"));
        assertThat(called).containsExactly(0, 1);
    }

    @Test
    @DisplayName("누적 시간이 예산에 닿으면 새 조회를 시작하지 않는다")
    void stopsWhenBudgetIsSpent() {
        // 시작 0초, 조회마다 2초씩 걸린다 — 0 · 2초에 시작하고 4초에 멈춘다
        long[] now = {0};
        List<Supplier<List<String>>> slow = new ArrayList<>();
        for (int index = 0; index < 5; index++) {
            int current = index;
            slow.add(() -> {
                called.add(current);
                now[0] += Duration.ofSeconds(2).toNanos();
                return List.of(String.valueOf(current));
            });
        }

        BudgetedLookups.Outcome<String> outcome = BudgetedLookups.run(slow, BUDGET, () -> now[0]);

        assertThat(outcome.stop()).isEqualTo(BudgetedLookups.Stop.BUDGET);
        assertThat(called).containsExactly(0, 1);
        assertThat(outcome.results()).hasSize(2);
    }

    /** {@code count} 개의 조회. {@code failAt} 번째(0부터)는 실패한다 — 음수면 모두 성공. */
    private List<Supplier<List<String>>> lookups(int count, int failAt) {
        List<Supplier<List<String>>> lookups = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            int current = index;
            lookups.add(() -> {
                called.add(current);
                if (current == failAt) {
                    throw new AiPlanException(AiPlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
                }
                return List.of(String.valueOf(current));
            });
        }
        return lookups;
    }
}
