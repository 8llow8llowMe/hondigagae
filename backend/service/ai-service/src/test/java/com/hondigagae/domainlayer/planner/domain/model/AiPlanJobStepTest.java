package com.hondigagae.domainlayer.planner.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 진행 단계의 번호 계약 (#90).
 *
 * <p>화면은 이 값으로 "3 / 4 단계" 를 그린다. {@code order} 와 {@code total} 을 손으로 적어
 * 두면 단계를 추가할 때 한쪽만 고쳐져 <b>"5 / 4 단계"</b> 가 나가므로, 둘 다 선언에서 파생한다.
 * 여기서 고정하는 것은 그 파생이 실제로 이어져 있다는 사실이다.
 */
class AiPlanJobStepTest {

    @Test
    @DisplayName("번호는 1부터 빈틈없이 이어진다")
    void ordersAreContiguousFromOne() {
        AiPlanJobStep[] steps = AiPlanJobStep.values();

        for (int index = 0; index < steps.length; index++) {
            assertThat(steps[index].order()).isEqualTo(index + 1);
        }
    }

    @Test
    @DisplayName("전체 단계 수는 값의 개수와 같다 — 마지막 단계의 번호이기도 하다")
    void totalMatchesTheNumberOfSteps() {
        assertThat(AiPlanJobStep.total()).isEqualTo(AiPlanJobStep.values().length);

        AiPlanJobStep last = AiPlanJobStep.values()[AiPlanJobStep.values().length - 1];
        assertThat(last.order()).isEqualTo(AiPlanJobStep.total());
    }

    @Test
    @DisplayName("모든 단계에 화면에 쓸 이름과 설명이 있다")
    void everyStepIsDescribable() {
        // 코드만 내려 주면 프론트가 한국어 문구를 자기 쪽에 복사해 두게 되고,
        // 단계를 바꿀 때 서버와 화면이 다른 말을 한다.
        assertThat(Arrays.stream(AiPlanJobStep.values()))
            .allSatisfy(step -> {
                assertThat(step.getDisplayName()).isNotBlank();
                assertThat(step.getDescription()).isNotBlank();
                assertThat(step.toMetadata().code()).isEqualTo(step.name());
            });
    }
}
