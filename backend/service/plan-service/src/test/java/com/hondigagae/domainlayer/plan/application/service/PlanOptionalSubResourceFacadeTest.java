package com.hondigagae.domainlayer.plan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanReviewResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanShareLinkResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanReviewPresenter;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanShareLinkPresenter;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanReviewItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanReviewRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanShareLinkRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanWalkCourseQueryPort;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanReviewProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanShareLinkProcessor;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanReview;
import com.hondigagae.domainlayer.plan.domain.model.PlanShareLink;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 선택적 하위 리소스(일정당 0~1개)의 "아직 없음" 은 오류가 아니다 (#979).
 *
 * <p>고정하는 것 — 소유자의 공유 링크 조회와 후기 조회는 대상이 없으면 {@code null} 을 돌려주고(컨트롤러가
 * 200 + {@code dataBody} null 로 싣는다), <b>일정 자체가 없거나 남의 것이면 여전히 {@code PLAN_001} 404</b> 다.
 * 후자가 무너지면 남의 planId 로 "후기 없음" 200 을 받아 일정의 존재를 떠볼 수 있게 된다.
 *
 * <p>Processor 와 Presenter 는 실물을 쓰고 저장소 포트만 Mockito 다. Facade 만 떼어 Processor 를 흉내 내면
 * "소유 확인이 조회보다 먼저 선다" 를 보지 못한다.
 */
class PlanOptionalSubResourceFacadeTest {

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final long PLAN_ID = 100L;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Clock CLOCK = Clock.fixed(LocalDate.of(2026, 9, 28).atStartOfDay(SEOUL).toInstant(), SEOUL);

    private PlanRepositoryPort planRepositoryPort;
    private PlanShareLinkRepositoryPort planShareLinkRepositoryPort;
    private PlanReviewRepositoryPort planReviewRepositoryPort;
    private PlanReviewItemRepositoryPort planReviewItemRepositoryPort;
    private PlanShareLinkWebFacade shareLinkFacade;
    private PlanReviewWebFacade reviewFacade;

    @BeforeEach
    void setUp() {
        planRepositoryPort = mock(PlanRepositoryPort.class);
        planShareLinkRepositoryPort = mock(PlanShareLinkRepositoryPort.class);
        planReviewRepositoryPort = mock(PlanReviewRepositoryPort.class);
        planReviewItemRepositoryPort = mock(PlanReviewItemRepositoryPort.class);
        PlanItemRepositoryPort planItemRepositoryPort = mock(PlanItemRepositoryPort.class);
        SnowflakeIdGenerator idGenerator = new SnowflakeIdGenerator(1, 1);

        PlanQueryProcessor queryProcessor = new PlanQueryProcessor(planRepositoryPort, planItemRepositoryPort,
            mock(PlanPetRepositoryPort.class), mock(PlanPlaceLookupPort.class), mock(PlanWalkCourseQueryPort.class));
        shareLinkFacade = new PlanShareLinkWebFacade(queryProcessor,
            new PlanShareLinkProcessor(planShareLinkRepositoryPort, planRepositoryPort, idGenerator, CLOCK), new PlanShareLinkPresenter());
        reviewFacade = new PlanReviewWebFacade(queryProcessor,
            new PlanReviewProcessor(planReviewRepositoryPort, planReviewItemRepositoryPort, planItemRepositoryPort, idGenerator),
            new PlanReviewPresenter());

        when(planRepositoryPort.findActiveById(PLAN_ID)).thenReturn(Optional.of(plan()));
        when(planShareLinkRepositoryPort.findValidByPlanId(anyLong(), any())).thenReturn(Optional.empty());
        when(planReviewRepositoryPort.findByPlanId(anyLong())).thenReturn(Optional.empty());
    }

    @Test
    @DisplayName("유효한 공유 링크가 없으면 소유자 조회는 오류 없이 null 이다")
    void shareLinkAbsentIsNull() {
        assertThat(shareLinkFacade.getShareLink(MEMBER_ID, PLAN_ID)).isNull();
    }

    @Test
    @DisplayName("유효한 공유 링크가 있으면 소유자 조회가 그 링크를 응답으로 돌려준다")
    void shareLinkPresentIsReturned() {
        LocalDateTime expiresAt = LocalDateTime.now(CLOCK).plusDays(30);
        when(planShareLinkRepositoryPort.findValidByPlanId(anyLong(), any())).thenReturn(Optional.of(PlanShareLink.builder()
            .id(7L).planId(PLAN_ID).token("t0k3n").expiresAt(expiresAt).build()));

        PlanShareLinkResponse response = shareLinkFacade.getShareLink(MEMBER_ID, PLAN_ID);

        assertThat(response).isNotNull();
        assertThat(response.planId()).isEqualTo(String.valueOf(PLAN_ID));
        assertThat(response.token()).isEqualTo("t0k3n");
        assertThat(response.expiresAt()).isEqualTo(expiresAt);
    }

    @Test
    @DisplayName("남의 일정·없는 일정의 공유 링크 조회는 여전히 PLAN_001 404 이고, 링크 저장소를 보지 않는다")
    void shareLinkOfForeignOrMissingPlanIsStillNotFound() {
        assertNotFoundPlan(() -> shareLinkFacade.getShareLink(OTHER_MEMBER_ID, PLAN_ID));
        assertNotFoundPlan(() -> shareLinkFacade.getShareLink(MEMBER_ID, PLAN_ID + 1));
        verifyNoInteractions(planShareLinkRepositoryPort);
    }

    @Test
    @DisplayName("후기가 없으면 조회는 오류 없이 null 이다")
    void reviewAbsentIsNull() {
        assertThat(reviewFacade.getReview(MEMBER_ID, PLAN_ID)).isNull();
    }

    @Test
    @DisplayName("후기가 있으면 조회가 그 후기를 응답으로 돌려준다")
    void reviewPresentIsReturned() {
        when(planReviewRepositoryPort.findByPlanId(PLAN_ID)).thenReturn(Optional.of(PlanReview.builder()
            .id(55L).planId(PLAN_ID).overallRating(4).body("둘째 날이 더웠다.").build()));
        when(planReviewItemRepositoryPort.findByReviewId(55L)).thenReturn(List.of());

        PlanReviewResponse response = reviewFacade.getReview(MEMBER_ID, PLAN_ID);

        assertThat(response).isNotNull();
        assertThat(response.reviewId()).isEqualTo("55");
        assertThat(response.overallRating()).isEqualTo(4);
        assertThat(response.items()).isEmpty();
    }

    @Test
    @DisplayName("남의 일정·없는 일정의 후기 조회는 여전히 PLAN_001 404 이고, 후기 저장소를 보지 않는다")
    void reviewOfForeignOrMissingPlanIsStillNotFound() {
        assertNotFoundPlan(() -> reviewFacade.getReview(OTHER_MEMBER_ID, PLAN_ID));
        assertNotFoundPlan(() -> reviewFacade.getReview(MEMBER_ID, PLAN_ID + 1));
        verifyNoInteractions(planReviewRepositoryPort, planReviewItemRepositoryPort);
    }

    private static void assertNotFoundPlan(ThrowingCallable call) {
        assertThatThrownBy(call)
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.NOT_FOUND_PLAN);
    }

    private static Plan plan() {
        return Plan.builder()
            .id(PLAN_ID)
            .memberId(MEMBER_ID)
            .petId(2L)
            .areaCode("39")
            .title("몽실이와 제주 2박 3일")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .status(PlanStatus.COMPLETED)
            .build();
    }
}
