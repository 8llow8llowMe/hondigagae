package com.hondigagae.domainlayer.planner.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.request.AiPlanCreateRequest;
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
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * AI 일정 생성 요청의 컬렉션 원소 검증.
 *
 * <p>plan-service 의 같은 이름 테스트와 <b>쌍으로 본다.</b> 두 서비스가 반려견 지정 규칙을
 * 공유한다고 문서에 적어 둔 이상, 같은 입력에 같은 반응을 해야 한다. 예전에는 여기서만
 * 값이 조용히 사라져 대표 반려견으로 폴백됐다 - 클라이언트는 자기 버그를 영영 못 봤다.
 */
class AiPlanCreateRequestValidationTest {

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

    @Nested
    @DisplayName("petIds")
    class PetIds {

        @Test
        @DisplayName("원소가 null 이면 막힌다")
        void rejectsNullElement() {
            Set<ConstraintViolation<AiPlanCreateRequest>> violations =
                validator.validate(request(Arrays.asList((Long) null), null));

            assertThat(violations).isNotEmpty();
            assertThat(messagesOf(violations)).allMatch(message -> message.startsWith("AIPLAN_105:"));
        }

        @Test
        @DisplayName("유효한 값과 섞여 있어도 막힌다")
        void rejectsNullMixedWithValidIds() {
            assertThat(validator.validate(request(Arrays.asList(1L, null), null))).isNotEmpty();
        }

        @Test
        @DisplayName("0 과 음수는 그대로 막힌다")
        void stillRejectsNonPositive() {
            assertThat(validator.validate(request(List.of(0L), null))).isNotEmpty();
            assertThat(validator.validate(request(List.of(-1L), null))).isNotEmpty();
        }
    }

    @Nested
    @DisplayName("pinnedPlaceIds")
    class PinnedPlaceIds {

        @Test
        @DisplayName("원소가 null 이면 막힌다 — 반드시 배치된다고 약속한 값이라 조용히 버릴 수 없다")
        void rejectsNullElement() {
            Set<ConstraintViolation<AiPlanCreateRequest>> violations =
                validator.validate(request(null, Arrays.asList((Long) null)));

            assertThat(violations).isNotEmpty();
            assertThat(messagesOf(violations)).allMatch(message -> message.startsWith("AIPLAN_110:"));
        }

        @Test
        @DisplayName("유효한 값과 섞여 있어도 막힌다")
        void rejectsNullMixedWithValidIds() {
            assertThat(validator.validate(request(null, Arrays.asList(1L, null)))).isNotEmpty();
        }
    }

    @Test
    @DisplayName("정상 목록과 빈 목록, 생략은 통과한다")
    void acceptsValidInput() {
        // "안 보낸 것"은 잘못된 입력이 아니다 - 대표 반려견 폴백이 정상 경로다.
        assertThat(validator.validate(request(List.of(1L, 2L), List.of(3L)))).isEmpty();
        assertThat(validator.validate(request(List.of(), List.of()))).isEmpty();
        assertThat(validator.validate(request(null, null))).isEmpty();
    }

    private static List<String> messagesOf(Set<ConstraintViolation<AiPlanCreateRequest>> violations) {
        return violations.stream().map(ConstraintViolation::getMessage).toList();
    }

    private AiPlanCreateRequest request(List<Long> petIds, List<Long> pinnedPlaceIds) {
        return new AiPlanCreateRequest(
            "39", null, LocalDate.of(2026, 9, 12), LocalDate.of(2026, 9, 13), null,
            null, petIds, pinnedPlaceIds, null, null, null, null);
    }
}
