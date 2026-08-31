package com.hondigagae.domainlayer.plan.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code targetId} 가 장소인지의 판정 — 이슈 #86 에서 도메인으로 올렸다.
 *
 * <p>저장 시 존재 검증(PlanCommandProcessor)과 상세 응답의 요약 조회(PlanQueryProcessor)가
 * 이 하나를 공유한다. 한쪽만 고쳐질 자리라 값으로 고정한다.
 */
class PlanItemTypeTest {

    @Test
    @DisplayName("PLACE · MEAL · LODGING 의 targetId 는 place.id 다")
    void placeTargets() {
        assertThat(PlanItemType.PLACE.isPlaceTarget()).isTrue();
        assertThat(PlanItemType.MEAL.isPlaceTarget()).isTrue();
        assertThat(PlanItemType.LODGING.isPlaceTarget()).isTrue();
    }

    @Test
    @DisplayName("WALK 는 아니다 — targetId 가 walk_course.id 라 장소로 조회하면 남의 아이디다")
    void walkIsNotPlaceTarget() {
        assertThat(PlanItemType.WALK.isPlaceTarget()).isFalse();
    }

    @Test
    @DisplayName("MOVE 는 아니다 — 대상이 없다")
    void moveIsNotPlaceTarget() {
        assertThat(PlanItemType.MOVE.isPlaceTarget()).isFalse();
    }
}
