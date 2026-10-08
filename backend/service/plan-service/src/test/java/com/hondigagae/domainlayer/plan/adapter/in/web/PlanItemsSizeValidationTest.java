package com.hondigagae.domainlayer.plan.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanCreateRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanDayItemsReplaceRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanItemRequest;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.shared.travel.plan.PlanItemType;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 일정 항목 수 상한의 요청 단계 (#1243).
 *
 * <p>상한이 없으면 일정 상세가 tour-service 에 묻는 장소 · 산책 코스 요약 질의 문자열이 항목 수만큼
 * 길어지고, 약 240개에서 Tomcat 헤더 한도(8KB)를 넘는다. 그 실패는 요약 장애로 삼켜져
 * <b>요약만 비는 조용한 품질 저하</b>가 된다 — 그래서 들어오는 문에서 400 으로 막는 것을 고정한다.
 *
 * <p>하루 교체 요청의 {@code @Size} 는 <b>한 날만으로 넘는 것</b>을 막는다. 다른 날 항목에 더해져 넘는
 * 경우는 요청 하나로는 알 수 없어 서비스 검증({@code PLAN_028}, {@code PlanItemLimitTest})이 맡는다.
 */
class PlanItemsSizeValidationTest {

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
    @DisplayName("생성 요청은 항목을 상한(100개)까지 받는다")
    void createAcceptsItemsUpToLimit() {
        assertThat(validator.validate(createRequest(items(Plan.MAX_ITEMS)))).isEmpty();
    }

    @Test
    @DisplayName("생성 요청의 항목이 101개면 items 필드 PLAN_136 이다 — AI 초안 담기도 같은 문이다")
    void createRejectsItemsOverLimit() {
        Set<ConstraintViolation<PlanCreateRequest>> violations = validator.validate(createRequest(items(Plan.MAX_ITEMS + 1)));

        assertThat(violations).singleElement().satisfies(violation -> {
            assertThat(violation.getPropertyPath()).hasToString("items");
            assertThat(violation.getMessage()).startsWith("PLAN_136:");
        });
    }

    @Test
    @DisplayName("하루 교체 요청도 한 날 상한(100개)까지는 받는다")
    void dayReplaceAcceptsItemsUpToLimit() {
        assertThat(validator.validate(new PlanDayItemsReplaceRequest(items(Plan.MAX_ITEMS)))).isEmpty();
    }

    @Test
    @DisplayName("하루 교체 요청이 한 날만으로 101개면 같은 PLAN_136 이다")
    void dayReplaceRejectsItemsOverLimit() {
        Set<ConstraintViolation<PlanDayItemsReplaceRequest>> violations =
            validator.validate(new PlanDayItemsReplaceRequest(items(Plan.MAX_ITEMS + 1)));

        assertThat(violations).singleElement().satisfies(violation -> {
            assertThat(violation.getPropertyPath()).hasToString("items");
            assertThat(violation.getMessage()).startsWith("PLAN_136:");
        });
    }

    @Test
    @DisplayName("항목 생략 · 빈 목록은 그대로 통과한다 — 빈 일정을 먼저 만들고 일자 편집에서 담는 흐름이다")
    void acceptsMissingOrEmptyItems() {
        assertThat(validator.validate(createRequest(null))).isEmpty();
        assertThat(validator.validate(createRequest(List.of()))).isEmpty();
        assertThat(validator.validate(new PlanDayItemsReplaceRequest(null))).isEmpty();
        assertThat(validator.validate(new PlanDayItemsReplaceRequest(List.of()))).isEmpty();
    }

    @Test
    @DisplayName("문구의 숫자는 상한 상수와 같다 — 값을 바꾸면 문구가 함께 바뀐다")
    void messageCarriesTheLimit() {
        Set<ConstraintViolation<PlanCreateRequest>> violations = validator.validate(createRequest(items(Plan.MAX_ITEMS + 1)));

        assertThat(violations).singleElement()
            .extracting(ConstraintViolation::getMessage)
            .isEqualTo("PLAN_136:일정 항목은 최대 " + Plan.MAX_ITEMS + "개까지 담을 수 있습니다.");
    }

    /** 검증을 통과하는 항목 {@code count} 개. 상한 경계만 보이게 다른 제약은 전부 지킨다. */
    private static List<PlanItemRequest> items(int count) {
        return IntStream.range(0, count)
            .mapToObj(sequence -> new PlanItemRequest(1, sequence, PlanItemType.PLACE, null, "항목 " + sequence, null, null))
            .toList();
    }

    private static PlanCreateRequest createRequest(List<PlanItemRequest> items) {
        return new PlanCreateRequest(
            null, null, "39", "4", "제주 2박 3일",
            LocalDate.of(2026, 9, 12), LocalDate.of(2026, 9, 14), null, items, null);
    }
}
