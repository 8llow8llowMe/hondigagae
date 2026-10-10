package com.hondigagae.shared.travel.plan;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code targetId} 가 장소인지의 판정 — #86 에서 도메인으로, #89 에서 서비스 밖으로 올렸다.
 *
 * <p>저장 시 존재 검증과 상세 응답의 요약 조회(plan-service), 그리고 AI 초안이 장소를 실을 수
 * 있는 유형인지의 판정(ai-service)이 이 하나를 공유한다. 한쪽만 고쳐질 자리라 값으로 고정한다.
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

    @Test
    @DisplayName("코드 문자열을 읽되 모르는 값에 예외를 던지지 않는다")
    void readsCodeLeniently() {
        // LLM 응답을 옮기는 자리에서 쓴다. 모델이 코드를 조금 다르게 적었다고 초안 생성
        // 전체를 실패시킬 이유는 없다 - 그 판단은 호출부가 한다.
        assertThat(PlanItemType.from("WALK")).contains(PlanItemType.WALK);
        assertThat(PlanItemType.from("walk")).contains(PlanItemType.WALK);
        assertThat(PlanItemType.from(" MEAL ")).contains(PlanItemType.MEAL);
        assertThat(PlanItemType.from("CAFE")).isEmpty();
        assertThat(PlanItemType.from("")).isEmpty();
        assertThat(PlanItemType.from(null)).isEmpty();
    }
}
