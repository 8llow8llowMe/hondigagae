package com.hondigagae.domainlayer.plan.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanReviewItemRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanReviewUpsertRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlanReviewRequestValidationTest {

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
    @DisplayName("전체 만족도가 없거나 1~5 밖이면 막힌다")
    void rejectsOverallRatingOutOfRange() {
        assertThat(validator.validate(request(null, List.of()))).isNotEmpty();
        assertThat(validator.validate(request(0, List.of()))).isNotEmpty();
        assertThat(validator.validate(request(6, List.of()))).isNotEmpty();
        assertThat(validator.validate(request(4, List.of()))).isEmpty();
    }

    @Test
    @DisplayName("items 가 null 이면 막힌다 — 빈 목록은 전체 만족도만 쓰는 정상 경로다")
    void rejectsNullItemsButAllowsEmpty() {
        assertThat(validator.validate(request(4, null))).isNotEmpty();
        assertThat(validator.validate(request(4, List.of()))).isEmpty();
    }

    @Test
    @DisplayName("장소 항목 아이디가 null 이면 막힌다 — @Positive 만으로는 [null] 이 통과한다")
    void rejectsNullPlanItemId() {
        Set<ConstraintViolation<PlanReviewUpsertRequest>> violations =
            validator.validate(request(4, List.of(new PlanReviewItemRequest(null, 5, "그늘"))));

        assertThat(violations).isNotEmpty();
        assertThat(messagesOf(violations)).anyMatch(message -> message.startsWith("PLAN_131:"));
    }

    @Test
    @DisplayName("장소 한 줄이 201자면 막힌다")
    void rejectsCommentOver200() {
        String tooLong = "가".repeat(201);
        Set<ConstraintViolation<PlanReviewUpsertRequest>> violations =
            validator.validate(request(4, List.of(new PlanReviewItemRequest(11L, 5, tooLong))));

        assertThat(violations).isNotEmpty();
        assertThat(messagesOf(violations)).anyMatch(message -> message.startsWith("PLAN_134:"));
    }

    @Test
    @DisplayName("유효한 장소 평가와 빈 본문은 통과한다")
    void acceptsValidPlaceReview() {
        assertThat(validator.validate(request(5, List.of(new PlanReviewItemRequest(11L, 4, null))))).isEmpty();
    }

    private static List<String> messagesOf(Set<ConstraintViolation<PlanReviewUpsertRequest>> violations) {
        return violations.stream().map(ConstraintViolation::getMessage).toList();
    }

    private static PlanReviewUpsertRequest request(Integer overallRating, List<PlanReviewItemRequest> items) {
        return new PlanReviewUpsertRequest(overallRating, "둘째 날이 더웠다.", items);
    }
}
