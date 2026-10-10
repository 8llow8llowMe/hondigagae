package com.hondigagae.domainlayer.plan.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanUpdateRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 일정 수정 요청의 {@code petIds} 검증 (#621).
 *
 * <p>수정 경로에 {@code petIds} 를 열면서 생성과 <b>같은 함정</b>을 물려받았다 —
 * {@code @Positive} 는 null 을 유효로 보므로(Bean Validation 스펙) 원소 제약을 값 제약만으로
 * 걸면 {@code [null]} 이 통과해 {@code plan_pet.pet_id} nullable=false 에서 500 이 난다
 * ({@link PlanCreateRequestValidationTest} 가 생성 쪽에서 고정한 것과 같은 결함이다).
 *
 * <p>수정에만 있는 축도 함께 고정한다 — <b>생략(null)은 유지</b>라 검증을 통과해야 하고,
 * <b>빈 목록</b>은 여기서 막지 않는다. "동행견을 모두 빼겠다" 는 뜻을 가진 입력이라
 * 형식이 아니라 도메인 규칙({@code PLAN_010})이 거절한다.
 */
class PlanUpdateRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void openValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        factory.close();
    }

    @Test
    @DisplayName("petIds 원소가 null 이면 검증에서 막힌다 — 생성과 같은 규칙이다")
    void rejectsNullElement() {
        Set<ConstraintViolation<PlanUpdateRequest>> violations =
            validator.validate(request(Arrays.asList(2L, null)));

        assertThat(violations).isNotEmpty();
        assertThat(messagesOf(violations)).allMatch(message -> message.startsWith("PLAN_101:"));
    }

    @Test
    @DisplayName("petIds 원소가 음수여도 막힌다")
    void rejectsNonPositiveElement() {
        Set<ConstraintViolation<PlanUpdateRequest>> violations = validator.validate(request(List.of(-1L)));

        assertThat(messagesOf(violations)).allMatch(message -> message.startsWith("PLAN_101:"));
    }

    @Test
    @DisplayName("여섯 마리부터는 막힌다 — 생성과 같은 상한(5)이다")
    void rejectsMoreThanFivePets() {
        Set<ConstraintViolation<PlanUpdateRequest>> violations =
            validator.validate(request(List.of(1L, 2L, 3L, 4L, 5L, 6L)));

        assertThat(messagesOf(violations)).allMatch(message -> message.startsWith("PLAN_115:"));
    }

    @Test
    @DisplayName("petIds 생략은 통과한다 — null 은 '동행견을 건드리지 않는다' 는 뜻이다")
    void acceptsOmittedPetIds() {
        assertThat(validator.validate(request(null))).isEmpty();
    }

    @Test
    @DisplayName("빈 목록은 형식 검증을 통과한다 — 거절은 PLAN_010 으로 도메인이 한다")
    void acceptsEmptyListAtValidationLayer() {
        assertThat(validator.validate(request(List.of()))).isEmpty();
    }

    @Test
    @DisplayName("중복 지정은 한 마리로 접되 순서는 지킨다 — 첫 번째가 대표 반려견이다")
    void dedupesKeepingOrder() {
        assertThat(request(List.of(9L, 2L, 9L)).toCommand().petIds()).containsExactly(9L, 2L);
    }

    private static PlanUpdateRequest request(List<Long> petIds) {
        return new PlanUpdateRequest(null, null, null, null, null, petIds);
    }

    private static List<String> messagesOf(Set<? extends ConstraintViolation<?>> violations) {
        return violations.stream().map(ConstraintViolation::getMessage).toList();
    }
}
