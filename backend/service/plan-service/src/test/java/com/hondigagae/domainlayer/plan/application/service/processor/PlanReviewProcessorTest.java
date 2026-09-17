package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.application.command.PlanReviewCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanReviewItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanReviewInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanReviewItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanReviewRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanReview;
import com.hondigagae.domainlayer.plan.domain.model.PlanReviewItem;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * 후기 규칙 검증. 쓰기는 완료된 일정에만 받고, 조회는 상태를 보지 않는다. 장소 평가는 그때의 항목을 기억한다.
 */
class PlanReviewProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long PLAN_ID = 100L;
    private static final long PLACE_ITEM_ID = 11L;
    private static final long WALK_ITEM_ID = 12L;
    private static final long UNVISITED_ITEM_ID = 13L;
    private static final long PLACE_ID = 900L;

    private StubPlanReviewRepositoryPort reviewPort;
    private StubPlanReviewItemRepositoryPort reviewItemPort;
    private StubPlanItemRepositoryPort planItemPort;
    private PlanReviewProcessor processor;

    @BeforeEach
    void setUp() {
        reviewPort = new StubPlanReviewRepositoryPort();
        reviewItemPort = new StubPlanReviewItemRepositoryPort();
        planItemPort = new StubPlanItemRepositoryPort();
        processor = new PlanReviewProcessor(
            reviewPort, reviewItemPort, planItemPort, new SnowflakeIdGenerator(1, 1));
        planItemPort.items.add(placeItem(PLACE_ITEM_ID, true, "천지연폭포", PLACE_ID));
        planItemPort.items.add(walkItem(WALK_ITEM_ID, true, "올레 7코스"));
        planItemPort.items.add(placeItem(UNVISITED_ITEM_ID, false, "카멜리아힐", 901L));
    }

    @Test
    @DisplayName("초안 일정은 후기를 쓰지 못한다 — 완료가 쓰기의 문이다")
    void rejectsDraftPlanWrite() {
        Plan draft = plan(PlanStatus.DRAFT);

        assertThatThrownBy(() -> processor.createReview(draft, command(4, List.of())))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_PLAN_NOT_COMPLETED);
        assertThatThrownBy(() -> processor.updateReview(draft, command(4, List.of())))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_PLAN_NOT_COMPLETED);
    }

    @Test
    @DisplayName("확정 일정도 후기 쓰기를 거절한다 — 다녀오기 전에 평가를 받지 않는다")
    void rejectsConfirmedPlanWrite() {
        assertThatThrownBy(() -> processor.createReview(plan(PlanStatus.CONFIRMED), command(4, List.of())))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_PLAN_NOT_COMPLETED);
    }

    @Test
    @DisplayName("완료를 확정으로 되돌려도 이미 쓴 후기는 그대로 조회된다 — 되돌리기가 기록을 지우지 않는다")
    void getReviewSurvivesReopen() {
        processor.createReview(completedPlan(), command(4, List.of(itemCommand(PLACE_ITEM_ID, 5, "그늘이 많았다."))));

        PlanReviewInfo reopened = processor.getReview(plan(PlanStatus.CONFIRMED));

        assertThat(reopened.overallRating()).isEqualTo(4);
        assertThat(reopened.items()).hasSize(1);
    }

    @Test
    @DisplayName("초안·확정에서 후기가 없으면 PLAN_015 다 — 조회를 막는 것은 상태가 아니라 후기의 존재다")
    void getReviewWithoutRowIsNotFoundRegardlessOfStatus() {
        assertThatThrownBy(() -> processor.getReview(plan(PlanStatus.DRAFT)))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_NOT_FOUND);
        assertThatThrownBy(() -> processor.getReview(plan(PlanStatus.CONFIRMED)))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_NOT_FOUND);
    }

    @Test
    @DisplayName("완료 일정에 후기가 없으면 조회는 404 다 — 빈 후기와 없는 후기를 나누지 않는다")
    void getReviewWithoutRowIsNotFound() {
        assertThatThrownBy(() -> processor.getReview(completedPlan()))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_NOT_FOUND);
    }

    @Test
    @DisplayName("이미 후기가 있으면 POST 는 409 다 — 수정은 PUT 경로다")
    void rejectsDuplicateCreate() {
        processor.createReview(completedPlan(), command(4, List.of()));

        assertThatThrownBy(() -> processor.createReview(completedPlan(), command(5, List.of())))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_ALREADY_EXISTS);
    }

    @Test
    @DisplayName("저장 연타로 유니크 인덱스가 터져도 같은 409 로 바꾼다 — 500 으로 나가지 않는다")
    void mapsUniqueViolationToConflict() {
        reviewPort.failOnSaveWithDuplicate = true;

        assertThatThrownBy(() -> processor.createReview(completedPlan(), command(4, List.of())))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_ALREADY_EXISTS);
    }

    @Test
    @DisplayName("다녀온 장소 항목은 제목과 placeId 를 후기가 기억한다")
    void snapshotsVisitedPlaceItem() {
        PlanReviewInfo info = processor.createReview(
            completedPlan(), command(4, List.of(itemCommand(PLACE_ITEM_ID, 5, "그늘이 많았다."))));

        assertThat(info.overallRating()).isEqualTo(4);
        assertThat(info.items()).singleElement().satisfies(item -> {
            assertThat(item.planItemId()).isEqualTo(PLACE_ITEM_ID);
            assertThat(item.placeId()).isEqualTo(PLACE_ID);
            assertThat(item.title()).isEqualTo("천지연폭포");
            assertThat(item.rating()).isEqualTo(5);
            assertThat(item.comment()).isEqualTo("그늘이 많았다.");
        });
    }

    @Test
    @DisplayName("방문하지 않은 장소 항목은 후기에 담지 못한다")
    void rejectsUnvisitedPlaceItem() {
        assertThatThrownBy(() -> processor.createReview(
            completedPlan(), command(4, List.of(itemCommand(UNVISITED_ITEM_ID, 3, null)))))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_ITEM_NOT_ELIGIBLE);
    }

    @Test
    @DisplayName("산책 항목은 장소 평가가 아니다 — targetId 가 walk_course.id 다")
    void rejectsWalkItem() {
        assertThatThrownBy(() -> processor.createReview(
            completedPlan(), command(4, List.of(itemCommand(WALK_ITEM_ID, 3, null)))))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_ITEM_NOT_ELIGIBLE);
    }

    @Test
    @DisplayName("없는 일정 항목 아이디는 거절한다 — 조용히 버리면 클라이언트가 자기 버그를 못 본다")
    void rejectsUnknownItem() {
        assertThatThrownBy(() -> processor.createReview(
            completedPlan(), command(4, List.of(itemCommand(999L, 3, null)))))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_ITEM_NOT_ELIGIBLE);
    }

    @Test
    @DisplayName("같은 항목을 한 요청에 두 번 넣으면 거절한다")
    void rejectsDuplicatePlanItemIdInRequest() {
        assertThatThrownBy(() -> processor.createReview(
            completedPlan(),
            command(4, List.of(itemCommand(PLACE_ITEM_ID, 5, null), itemCommand(PLACE_ITEM_ID, 3, null)))))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_ITEM_DUPLICATED);
    }

    @Test
    @DisplayName("일차 교체로 항목이 사라져도 PUT 은 옛 제목·placeId 를 유지한 채 평점만 고친다")
    void updateKeepsSnapshotWhenPlanItemGone() {
        processor.createReview(completedPlan(), command(4, List.of(itemCommand(PLACE_ITEM_ID, 5, "처음"))));
        planItemPort.items.removeIf(item -> item.id() == PLACE_ITEM_ID);

        PlanReviewInfo info = processor.updateReview(
            completedPlan(), command(3, List.of(itemCommand(PLACE_ITEM_ID, 2, "다시 생각하니 붐볐다."))));

        assertThat(info.overallRating()).isEqualTo(3);
        assertThat(info.items()).singleElement().satisfies(item -> {
            assertThat(item.planItemId()).isEqualTo(PLACE_ITEM_ID);
            assertThat(item.placeId()).isEqualTo(PLACE_ID);
            assertThat(item.title()).isEqualTo("천지연폭포");
            assertThat(item.rating()).isEqualTo(2);
            assertThat(item.comment()).isEqualTo("다시 생각하니 붐볐다.");
        });
    }

    @Test
    @DisplayName("항목이 아직 있으면 PUT 은 제목·placeId 를 현재 값으로 갱신한다")
    void updateRefreshesSnapshotWhenItemStillThere() {
        processor.createReview(completedPlan(), command(4, List.of(itemCommand(PLACE_ITEM_ID, 5, null))));
        planItemPort.items.removeIf(item -> item.id() == PLACE_ITEM_ID);
        planItemPort.items.add(placeItem(PLACE_ITEM_ID, true, "천지연폭포 야경", 911L));

        PlanReviewInfo info = processor.updateReview(
            completedPlan(), command(5, List.of(itemCommand(PLACE_ITEM_ID, 4, null))));

        assertThat(info.items()).singleElement().satisfies(item -> {
            assertThat(item.title()).isEqualTo("천지연폭포 야경");
            assertThat(item.placeId()).isEqualTo(911L);
            assertThat(item.rating()).isEqualTo(4);
        });
    }

    @Test
    @DisplayName("PUT 의 items 가 빈 목록이면 장소 평가를 모두 지운다 — 전량 교체다")
    void updateWithEmptyItemsClearsPlaceReviews() {
        processor.createReview(completedPlan(), command(4, List.of(itemCommand(PLACE_ITEM_ID, 5, "남김"))));

        PlanReviewInfo info = processor.updateReview(completedPlan(), command(5, List.of()));

        assertThat(info.overallRating()).isEqualTo(5);
        assertThat(info.items()).isEmpty();
        assertThat(reviewItemPort.items).isEmpty();
    }

    @Test
    @DisplayName("후기가 없는데 PUT 하면 404 다 — 없는 글을 고치는 경로를 열지 않는다")
    void updateWithoutReviewIsNotFound() {
        assertThatThrownBy(() -> processor.updateReview(completedPlan(), command(4, List.of())))
            .isInstanceOf(PlanException.class)
            .extracting(ex -> ((PlanException) ex).getErrorCode())
            .isEqualTo(PlanErrorCode.REVIEW_NOT_FOUND);
    }

    @Test
    @DisplayName("빈 본문은 null 로 저장한다 — 공백만 있는 후기를 본문 있음으로 치지 않는다")
    void blanksBecomeNull() {
        PlanReviewInfo info = processor.createReview(completedPlan(), command(4, "   ", List.of()));

        assertThat(info.body()).isNull();
    }

    private static Plan completedPlan() {
        return plan(PlanStatus.COMPLETED);
    }

    private static Plan plan(PlanStatus status) {
        return Plan.builder()
            .id(PLAN_ID)
            .memberId(MEMBER_ID)
            .petId(7L)
            .areaCode("39")
            .title("몽실이와 제주 2박 3일")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .status(status)
            .build();
    }

    private static PlanReviewCommand command(int overallRating, List<PlanReviewItemCommand> items) {
        return command(overallRating, "둘째 날이 더웠다.", items);
    }

    private static PlanReviewCommand command(int overallRating, String body, List<PlanReviewItemCommand> items) {
        return PlanReviewCommand.builder()
            .overallRating(overallRating)
            .body(body)
            .items(items)
            .build();
    }

    private static PlanReviewItemCommand itemCommand(long planItemId, int rating, String comment) {
        return PlanReviewItemCommand.builder()
            .planItemId(planItemId)
            .rating(rating)
            .comment(comment)
            .build();
    }

    private static PlanItem placeItem(long id, boolean visited, String title, Long placeId) {
        return PlanItem.builder()
            .id(id)
            .planId(PLAN_ID)
            .day(1)
            .sequence(0)
            .itemType(PlanItemType.PLACE)
            .targetId(placeId)
            .title(title)
            .visited(visited)
            .build();
    }

    private static PlanItem walkItem(long id, boolean visited, String title) {
        return PlanItem.builder()
            .id(id)
            .planId(PLAN_ID)
            .day(1)
            .sequence(1)
            .itemType(PlanItemType.WALK)
            .targetId(77L)
            .title(title)
            .visited(visited)
            .build();
    }

    private static class StubPlanReviewRepositoryPort implements PlanReviewRepositoryPort {

        private final List<PlanReview> reviews = new ArrayList<>();
        private boolean failOnSaveWithDuplicate;
        private LocalDateTime clock = LocalDateTime.of(2026, 9, 15, 11, 0, 0);

        @Override
        public Optional<PlanReview> findByPlanId(long planId) {
            return reviews.stream().filter(review -> review.planId() == planId).findFirst();
        }

        @Override
        public boolean existsByPlanId(long planId) {
            return reviews.stream().anyMatch(review -> review.planId() == planId);
        }

        @Override
        public PlanReview save(PlanReview review) {
            if (failOnSaveWithDuplicate) {
                throw new DataIntegrityViolationException("uk_plan_review_plan_id");
            }
            clock = clock.plusSeconds(1);
            PlanReview saved = review.toBuilder()
                .createdAt(review.createdAt() == null ? clock : review.createdAt())
                .updatedAt(clock)
                .build();
            reviews.removeIf(stored -> stored.id() == saved.id() || stored.planId() == saved.planId());
            reviews.add(saved);
            return saved;
        }
    }

    private static class StubPlanReviewItemRepositoryPort implements PlanReviewItemRepositoryPort {

        private final List<PlanReviewItem> items = new ArrayList<>();

        @Override
        public List<PlanReviewItem> findByReviewId(long reviewId) {
            return items.stream()
                .filter(item -> item.reviewId() == reviewId)
                .sorted(Comparator.comparingInt(PlanReviewItem::sortOrder).thenComparingLong(PlanReviewItem::id))
                .toList();
        }

        @Override
        public List<PlanReviewItem> saveAll(List<PlanReviewItem> saving) {
            saving.forEach(item -> items.removeIf(stored -> stored.id() == item.id()));
            items.addAll(saving);
            return List.copyOf(saving);
        }

        @Override
        public void deleteByReviewId(long reviewId) {
            items.removeIf(item -> item.reviewId() == reviewId);
        }
    }

    private static class StubPlanItemRepositoryPort implements PlanItemRepositoryPort {

        private final List<PlanItem> items = new ArrayList<>();

        @Override
        public List<PlanItem> saveAll(List<PlanItem> items) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanItem> findByPlanId(long planId) {
            return items.stream().filter(item -> item.planId() == planId).toList();
        }

        @Override
        public Optional<PlanItem> findById(long planItemId) {
            return items.stream().filter(item -> item.id() == planItemId).findFirst();
        }

        @Override
        public PlanItem save(PlanItem item) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteByPlanIdAndDay(long planId, int day) {
            throw new UnsupportedOperationException();
        }
    }
}
