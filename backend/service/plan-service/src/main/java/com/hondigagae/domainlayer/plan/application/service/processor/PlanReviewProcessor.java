package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.command.PlanReviewCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanReviewItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanReviewInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanReviewItemInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanReviewItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanReviewRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanReview;
import com.hondigagae.domainlayer.plan.domain.model.PlanReviewItem;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class PlanReviewProcessor {

    /**
     * 표시 순서 비교자. {@code toInfo} 와 out-port 의 정렬이 <b>같은 규칙</b>이어야 한다 —
     * 한쪽만 tie-break 이 없으면 PUT 응답 순서와 직후 GET 순서가 갈린다.
     */
    private static final Comparator<PlanReviewItem> BY_DISPLAY_ORDER =
        Comparator.comparingInt(PlanReviewItem::sortOrder).thenComparingLong(PlanReviewItem::id);

    private final PlanReviewRepositoryPort planReviewRepositoryPort;
    private final PlanReviewItemRepositoryPort planReviewItemRepositoryPort;
    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public PlanReviewInfo getReview(Plan plan) {
        requireCompleted(plan);
        PlanReview review = planReviewRepositoryPort.findByPlanId(plan.id())
            .orElseThrow(() -> new PlanException(PlanErrorCode.REVIEW_NOT_FOUND));
        return toInfo(review, planReviewItemRepositoryPort.findByReviewId(review.id()));
    }

    /**
     * 일정당 후기 하나. 이미 있으면 409 다 — PUT 이 수정 경로이고 POST 를 멱등으로 두면
     * "썼는지" 를 클라이언트가 구분할 수 없다.
     *
     * <p>유니크 인덱스 위반은 검사와 INSERT 사이의 연타에서 난다. flush 한 뒤 여기서 409 로 바꾼다.
     */
    @Transactional
    public PlanReviewInfo createReview(Plan plan, PlanReviewCommand command) {
        requireCompleted(plan);
        if (planReviewRepositoryPort.existsByPlanId(plan.id())) {
            throw new PlanException(PlanErrorCode.REVIEW_ALREADY_EXISTS);
        }
        assertNoDuplicateItemIds(command.items());

        List<PlanItem> planItems = planItemRepositoryPort.findByPlanId(plan.id());
        List<PlanReviewItem> snapshots = resolveItemsForCreate(planItems, command.items());

        PlanReview saved;
        try {
            saved = planReviewRepositoryPort.save(PlanReview.builder()
                .id(snowflakeIdGenerator.generateId())
                .planId(plan.id())
                .overallRating(command.overallRating())
                .body(blankToNull(command.body()))
                .build());
        } catch (DataIntegrityViolationException exception) {
            throw new PlanException(PlanErrorCode.REVIEW_ALREADY_EXISTS);
        }

        return toInfo(saved, persistItems(saved.id(), snapshots));
    }

    /**
     * 장소별 평가는 <b>전량 교체</b>다. 빠진 스냅샷은 사라지고, 일차 교체로 항목이 없어도
     * 이미 기억한 planItemId 는 제목·placeId 를 유지한 채 평점·한 줄만 고친다.
     */
    @Transactional
    public PlanReviewInfo updateReview(Plan plan, PlanReviewCommand command) {
        requireCompleted(plan);
        PlanReview existing = planReviewRepositoryPort.findByPlanId(plan.id())
            .orElseThrow(() -> new PlanException(PlanErrorCode.REVIEW_NOT_FOUND));
        assertNoDuplicateItemIds(command.items());

        List<PlanItem> planItems = planItemRepositoryPort.findByPlanId(plan.id());
        List<PlanReviewItem> previousItems = planReviewItemRepositoryPort.findByReviewId(existing.id());
        List<PlanReviewItem> snapshots = resolveItemsForUpdate(planItems, previousItems, command.items());

        PlanReview saved = planReviewRepositoryPort.save(existing.toBuilder()
            .overallRating(command.overallRating())
            .body(blankToNull(command.body()))
            .build());

        // 삭제가 먼저다. 큐잉되면 같은 (reviewId, planItemId) 가 옛 행과 겹쳐 유니크 인덱스 위반으로 죽는다.
        planReviewItemRepositoryPort.deleteByReviewId(existing.id());
        return toInfo(saved, persistItems(existing.id(), snapshots));
    }

    private static void requireCompleted(Plan plan) {
        if (plan.status() != PlanStatus.COMPLETED) {
            throw new PlanException(PlanErrorCode.REVIEW_PLAN_NOT_COMPLETED);
        }
    }

    private static void assertNoDuplicateItemIds(List<PlanReviewItemCommand> items) {
        Set<Long> seen = new HashSet<>();
        for (PlanReviewItemCommand item : items) {
            if (!seen.add(item.planItemId())) {
                throw new PlanException(PlanErrorCode.REVIEW_ITEM_DUPLICATED);
            }
        }
    }

    private List<PlanReviewItem> resolveItemsForCreate(List<PlanItem> planItems, List<PlanReviewItemCommand> commands) {
        Map<Long, PlanItem> byId = indexById(planItems);
        List<PlanReviewItem> resolved = new ArrayList<>();
        int sortOrder = 0;
        for (PlanReviewItemCommand command : commands) {
            PlanItem item = byId.get(command.planItemId());
            if (!isEligiblePlaceVisit(item)) {
                throw new PlanException(PlanErrorCode.REVIEW_ITEM_NOT_ELIGIBLE);
            }
            resolved.add(snapshotFromCurrent(item, command, sortOrder++));
        }
        return resolved;
    }

    private List<PlanReviewItem> resolveItemsForUpdate(
        List<PlanItem> planItems,
        List<PlanReviewItem> previousItems,
        List<PlanReviewItemCommand> commands
    ) {
        Map<Long, PlanItem> byId = indexById(planItems);
        Map<Long, PlanReviewItem> previousByPlanItemId = previousItems.stream()
            .collect(Collectors.toMap(PlanReviewItem::planItemId, Function.identity()));

        List<PlanReviewItem> resolved = new ArrayList<>();
        int sortOrder = 0;
        for (PlanReviewItemCommand command : commands) {
            PlanItem current = byId.get(command.planItemId());
            PlanReviewItem previous = previousByPlanItemId.get(command.planItemId());
            if (isEligiblePlaceVisit(current)) {
                resolved.add(snapshotFromCurrent(current, command, sortOrder++));
                continue;
            }
            if (previous == null) {
                throw new PlanException(PlanErrorCode.REVIEW_ITEM_NOT_ELIGIBLE);
            }
            // 일차 교체로 항목이 없어도 그때의 제목·placeId 는 유지한다.
            resolved.add(previous.toBuilder()
                .rating(command.rating())
                .comment(blankToNull(command.comment()))
                .sortOrder(sortOrder++)
                .build());
        }
        return resolved;
    }

    private PlanReviewItem snapshotFromCurrent(PlanItem item, PlanReviewItemCommand command, int sortOrder) {
        return PlanReviewItem.builder()
            .id(0L)
            .reviewId(0L)
            .planItemId(item.id())
            .placeId(item.targetId())
            .title(item.title())
            .rating(command.rating())
            .comment(blankToNull(command.comment()))
            .sortOrder(sortOrder)
            .build();
    }

    private List<PlanReviewItem> persistItems(long reviewId, List<PlanReviewItem> snapshots) {
        if (snapshots.isEmpty()) {
            return List.of();
        }
        // PUT 교체 때도 아이디를 새로 뽑는다. 벌크 삭제 직후 같은 PK 를 재사용하면
        // 1차 캐시·디태치 타이밍에 따라 INSERT 가 갱신으로 오인될 수 있다. 클라이언트가
        // 다시 보내는 키는 planItemId 라 reviewItemId 가 바뀌어도 계약이 깨지지 않는다.
        List<PlanReviewItem> toSave = new ArrayList<>();
        for (PlanReviewItem snapshot : snapshots) {
            toSave.add(snapshot.toBuilder()
                .id(snowflakeIdGenerator.generateId())
                .reviewId(reviewId)
                .build());
        }
        return planReviewItemRepositoryPort.saveAll(toSave);
    }

    /**
     * 다녀온 <b>장소</b> 항목만 후기에 담는다. WALK 의 targetId 는 walk_course.id 라 장소 평가가
     * 아니고, 방문 체크가 꺼진 항목은 "그때 간 곳"이 아니다.
     */
    private static boolean isEligiblePlaceVisit(PlanItem item) {
        return item != null && item.itemType().isPlaceTarget() && item.visited();
    }

    private static Map<Long, PlanItem> indexById(List<PlanItem> planItems) {
        return planItems.stream().collect(Collectors.toMap(PlanItem::id, Function.identity()));
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }

    private PlanReviewInfo toInfo(PlanReview review, List<PlanReviewItem> items) {
        List<PlanReviewItem> sorted = items.stream().sorted(BY_DISPLAY_ORDER).toList();
        return PlanReviewInfo.builder()
            .reviewId(review.id())
            .planId(review.planId())
            .overallRating(review.overallRating())
            .body(review.body())
            .items(sorted.stream().map(this::toItemInfo).toList())
            .createdAt(review.createdAt())
            .updatedAt(review.updatedAt())
            .build();
    }

    private PlanReviewItemInfo toItemInfo(PlanReviewItem item) {
        return PlanReviewItemInfo.builder()
            .reviewItemId(item.id())
            .planItemId(item.planItemId())
            .placeId(item.placeId())
            .title(item.title())
            .rating(item.rating())
            .comment(item.comment())
            .sortOrder(item.sortOrder())
            .build();
    }
}
