package com.hondigagae.domainlayer.planner.application.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 준비물 특성 조회 대상 산출 검증.
 *
 * <p>{@code petIds} 는 plan-service 가 나중에 내리기 시작한 필드라 <b>옛 일정에는 없다.</b>
 * 그때 특성 없이 준비물을 만드는 것보다 대표 한 마리라도 보는 편이 낫고, 그 폴백이 조용히
 * 사라지지 않게 고정한다.
 */
class PlanOutlineConditionPetIdsTest {

    @Test
    @DisplayName("petIds 가 있으면 전부 쓴다")
    void usesEveryPetId() {
        assertThat(outline(1L, List.of(1L, 2L, 3L)).conditionPetIds())
            .containsExactly(1L, 2L, 3L);
    }

    @Test
    @DisplayName("petIds 가 없으면 대표 한 마리로 접는다 — 옛 응답 호환")
    void fallsBackToRepresentative() {
        assertThat(outline(7L, null).conditionPetIds()).containsExactly(7L);
        assertThat(outline(7L, List.of()).conditionPetIds()).containsExactly(7L);
    }

    @Test
    @DisplayName("둘 다 없으면 비어 있다 — 특성 없이 일정 개요만으로 만든다")
    void emptyWhenNoPetAtAll() {
        assertThat(outline(null, null).conditionPetIds()).isEmpty();
    }

    @Test
    @DisplayName("중복과 null 원소를 걸러낸다")
    void dropsDuplicatesAndNulls() {
        // 원소 null 은 요청 단계에서 막히지만, 개요는 다른 서비스가 준 값이라 방어한다.
        assertThat(outline(1L, Arrays.asList(1L, null, 1L, 2L)).conditionPetIds())
            .containsExactly(1L, 2L);
    }

    private PlanOutline outline(Long petId, List<Long> petIds) {
        return PlanOutline.builder()
            .planId(1L).petId(petId).petIds(petIds)
            .areaCode("39").startDate("2026-09-12").endDate("2026-09-14")
            .build();
    }
}
