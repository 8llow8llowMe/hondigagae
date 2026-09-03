package com.hondigagae.domainlayer.plan.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanCreateRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 일정 생성 요청의 컬렉션 원소 검증.
 *
 * <p><b>{@code @Positive} 는 null 을 유효로 본다</b>(Bean Validation 스펙). 그래서 원소 제약을
 * 값 제약만으로 걸면 {@code [null]} 이 검증을 통과해 버린다. 통과한 뒤에 무슨 일이 나는지는
 * 서비스마다 다르다 - plan-service 는 {@code plan_pet.pet_id} 가 nullable=false 라 저장에서
 * 500 이 나고, ai-service 는 값이 조용히 사라져 대표 반려견으로 폴백한다.
 *
 * <p>같은 규칙을 쓴다고 문서에 적어 둔 두 서비스가 같은 입력에 다르게 반응하는 것이 이 결함의
 * 본질이라, 여기서 <b>400 으로 막히는 것</b>을 고정한다.
 */
class PlanCreateRequestValidationTest {

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
    @DisplayName("petIds 원소가 null 이면 검증에서 막힌다")
    void rejectsNullElement() {
        Set<ConstraintViolation<PlanCreateRequest>> violations =
            validator.validate(request(Arrays.asList((Long) null)));

        assertThat(violations).isNotEmpty();
        assertThat(messagesOf(violations)).allMatch(message -> message.startsWith("PLAN_101:"));
    }

    @Test
    @DisplayName("유효한 값과 섞여 있어도 막힌다")
    void rejectsNullMixedWithValidIds() {
        // 저장 시점에 두 번째 plan_pet 행에서 터지던 입력이다.
        Set<ConstraintViolation<PlanCreateRequest>> violations =
            validator.validate(request(Arrays.asList(1L, null)));

        assertThat(violations).isNotEmpty();
    }

    @Test
    @DisplayName("0 과 음수도 그대로 막힌다 — 부호 검증이 사라지지 않았다")
    void stillRejectsNonPositiveElement() {
        assertThat(validator.validate(request(List.of(0L)))).isNotEmpty();
        assertThat(validator.validate(request(List.of(-1L)))).isNotEmpty();
    }

    @Test
    @DisplayName("정상 목록과 빈 목록, 생략은 통과한다")
    void acceptsValidInput() {
        // "안 보낸 것"은 잘못된 입력이 아니다 - 대표 반려견 폴백이 정상 경로다.
        assertThat(validator.validate(request(List.of(1L, 2L)))).isEmpty();
        assertThat(validator.validate(request(List.of()))).isEmpty();
        assertThat(validator.validate(request(null))).isEmpty();
    }

    private static List<String> messagesOf(Set<ConstraintViolation<PlanCreateRequest>> violations) {
        return violations.stream().map(ConstraintViolation::getMessage).toList();
    }

    private PlanCreateRequest request(List<Long> petIds) {
        return new PlanCreateRequest(
            null, petIds, "39", "4", "제주 2박 3일",
            LocalDate.of(2026, 9, 12), LocalDate.of(2026, 9, 14), null, null);
    }
}
