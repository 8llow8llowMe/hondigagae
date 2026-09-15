package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanReviewEntity;
import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanReviewItemEntity;
import com.hondigagae.persistence.config.JpaAuditConfig;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

/**
 * 후기 장소 평가 리포지터리의 실제 스키마 검증 — 벌크 DML 과 파생 쿼리는 컴파일로 검증되지 않는다.
 */
@DataJpaTest
@EntityScan("com.hondigagae.domainlayer")
@Import(JpaAuditConfig.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlanReviewItemRepositoryTest {

    @SpringBootConfiguration
    @EnableJpaRepositories(basePackages = "com.hondigagae.domainlayer")
    static class SliceConfig {
    }

    private static final long REVIEW_ID = 10L;
    private static final long OTHER_REVIEW_ID = 20L;
    private static final long PLAN_ITEM_ID = 11L;

    @Autowired
    private PlanReviewRepository planReviewRepository;

    @Autowired
    private PlanReviewItemRepository planReviewItemRepository;

    @Test
    @DisplayName("같은 (reviewId, planItemId) 를 지우고 곧바로 다시 넣어도 유니크 인덱스에 걸리지 않는다")
    void reinsertsSamePlanItemAfterBulkDeleteWithinOneTransaction() {
        planReviewRepository.saveAndFlush(review(REVIEW_ID, 100L));
        planReviewItemRepository.saveAndFlush(item(1L, REVIEW_ID, PLAN_ITEM_ID, "천지연폭포", 0));

        assertThatCode(() -> {
            planReviewItemRepository.deleteByReviewId(REVIEW_ID);
            planReviewItemRepository.saveAndFlush(item(2L, REVIEW_ID, PLAN_ITEM_ID, "천지연폭포", 0));
        }).doesNotThrowAnyException();

        assertThat(planReviewItemRepository.findByReviewIdOrderBySortOrderAscIdAsc(REVIEW_ID))
            .extracting(PlanReviewItemEntity::getId).containsExactly(2L);
    }

    @Test
    @DisplayName("같은 (reviewId, planItemId) 두 줄은 flush 시점에 거절된다")
    void rejectsDuplicatePlanItemWithinReviewOnFlush() {
        planReviewRepository.saveAndFlush(review(REVIEW_ID, 100L));
        planReviewItemRepository.saveAndFlush(item(1L, REVIEW_ID, PLAN_ITEM_ID, "천지연폭포", 0));

        assertThatThrownBy(() -> planReviewItemRepository.saveAndFlush(
            item(2L, REVIEW_ID, PLAN_ITEM_ID, "다른 제목", 1)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("reviewId 삭제는 다른 후기 행에 닿지 않는다")
    void deleteByReviewIdIgnoresOtherReview() {
        planReviewRepository.saveAll(List.of(review(REVIEW_ID, 100L), review(OTHER_REVIEW_ID, 200L)));
        planReviewRepository.flush();
        planReviewItemRepository.saveAll(List.of(
            item(1L, REVIEW_ID, PLAN_ITEM_ID, "천지연폭포", 0),
            item(2L, OTHER_REVIEW_ID, PLAN_ITEM_ID, "카멜리아힐", 0)));
        planReviewItemRepository.flush();

        planReviewItemRepository.deleteByReviewId(REVIEW_ID);

        assertThat(planReviewItemRepository.findByReviewIdOrderBySortOrderAscIdAsc(REVIEW_ID)).isEmpty();
        assertThat(planReviewItemRepository.findByReviewIdOrderBySortOrderAscIdAsc(OTHER_REVIEW_ID))
            .extracting(PlanReviewItemEntity::getId).containsExactly(2L);
    }

    @Test
    @DisplayName("sortOrder 오름차순, 같으면 아이디 오름차순으로 나온다")
    void ordersBySortOrderThenId() {
        planReviewRepository.saveAndFlush(review(REVIEW_ID, 100L));
        planReviewItemRepository.saveAll(List.of(
            item(30L, REVIEW_ID, 13L, "우도", 1),
            item(10L, REVIEW_ID, 12L, "카멜리아힐", 1),
            item(20L, REVIEW_ID, 11L, "천지연폭포", 0)));
        planReviewItemRepository.flush();

        assertThat(planReviewItemRepository.findByReviewIdOrderBySortOrderAscIdAsc(REVIEW_ID))
            .extracting(PlanReviewItemEntity::getId).containsExactly(20L, 10L, 30L);
    }

    @Test
    @DisplayName("같은 planId 의 후기는 하나다 — 일정당 후기 하나의 마지막 방어선")
    void rejectsSecondReviewForSamePlan() {
        planReviewRepository.saveAndFlush(review(REVIEW_ID, 100L));

        assertThatThrownBy(() -> planReviewRepository.saveAndFlush(review(OTHER_REVIEW_ID, 100L)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static PlanReviewEntity review(long id, long planId) {
        return PlanReviewEntity.builder()
            .id(id)
            .planId(planId)
            .overallRating(4)
            .body("둘째 날이 더웠다.")
            .build();
    }

    private static PlanReviewItemEntity item(long id, long reviewId, long planItemId, String title, int sortOrder) {
        return PlanReviewItemEntity.builder()
            .id(id)
            .reviewId(reviewId)
            .planItemId(planItemId)
            .placeId(900L)
            .title(title)
            .rating(5)
            .sortOrder(sortOrder)
            .build();
    }
}
