package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemPlaceInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanSummaryInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlaceSummaryQueryResult;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.util.List;
import java.util.Objects;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlanQueryProcessor {

    private final PlanRepositoryPort planRepositoryPort;
    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PlanPlaceLookupPort planPlaceLookupPort;

    /**
     * 본인 소유의 활성 일정을 조회한다.
     * 타인 소유 일정은 존재 자체를 노출하지 않기 위해 동일하게 404 로 처리한다.
     */
    public Plan getOwnedPlan(long memberId, long planId) {
        return planRepositoryPort.findActiveById(planId)
            .filter(plan -> plan.isOwnedBy(memberId))
            .orElseThrow(() -> new PlanException(PlanErrorCode.NOT_FOUND_PLAN));
    }

    /**
     * 장소 요약이 붙은 일정 상세 (이슈 #86).
     *
     * <p>{@code PlanDetailResponse} 를 내려주는 경로는 <b>전부 이 메서드를 쓴다.</b> 조회에만
     * 붙이면 같은 DTO 가 진입 경로에 따라 주소를 갖거나 안 갖게 되고, 프론트는 항목을 편집한
     * 직후에만 주소가 사라지는 화면을 보게 된다.
     *
     * <p><b>{@link #getPlanInfo} 와 나눠 둔 이유</b>: 내부 outline 조회와 응급 브리핑은 요약이
     * 필요 없고, 브리핑은 자기 몫의 조회를 이미 한다 — 한 메서드로 합치면 그 두 경로에 쓰지 않는
     * 원격 호출이 생긴다.
     */
    public PlanInfo getPlanDetailInfo(Plan plan) {
        List<PlanItem> items = planItemRepositoryPort.findByPlanId(plan.id());
        Map<Long, PlanPlaceSummaryQueryResult> summaries = findPlaceSummaries(items);

        return toPlanInfo(plan, items.stream()
            .map(item -> toItemInfo(item, findSummary(summaries, item)))
            .toList());
    }

    public PlanInfo getPlanInfo(Plan plan) {
        List<PlanItemInfo> items = planItemRepositoryPort.findByPlanId(plan.id()).stream()
            .map(item -> toItemInfo(item, null))
            .toList();

        return toPlanInfo(plan, items);
    }

    /**
     * 항목이 가리키는 장소를 <b>한 번에</b> 받아 온다 — 항목마다 부르면 일정 하나 조회에 HTTP
     * 왕복이 항목 수만큼 생긴다 (이 이슈가 프론트에서 없애려는 것과 같은 문제다).
     *
     * <p>중복을 제거한다: 며칠 연속 같은 숙소를 담으면 같은 아이디가 여러 번 나온다.
     */
    private Map<Long, PlanPlaceSummaryQueryResult> findPlaceSummaries(List<PlanItem> items) {
        List<Long> placeIds = items.stream()
            .map(PlanQueryProcessor::placeTargetIdOf)
            .filter(Objects::nonNull)
            .distinct()
            .toList();

        if (placeIds.isEmpty()) {
            return Map.of();
        }

        /*
          **tour-service 장애를 일정 상세 조회 실패로 번지게 하지 않는다.** 일정은 우리 DB 의
          자료이고 장소 요약은 장식이다 — 요약을 못 받았다고 사용자가 자기 일정을 못 보게 되면
          안 된다. 즐겨찾기 목록이 같은 판단을 이미 했다 (services/plan-service.md).

          응급 브리핑은 반대로 삼키지 않는다. 그쪽은 시설 없는 브리핑이 "가까운 병원이 없다" 는
          착각을 주기 때문이다 — 여기는 주소가 빈 행일 뿐이다.
        */
        try {
            return planPlaceLookupPort.findSummaries(placeIds).stream()
                .collect(Collectors.toMap(PlanPlaceSummaryQueryResult::placeId, Function.identity()));
        } catch (PlanException exception) {
            log.warn("Plan item place decoration failed, returning items without place. errorCode={}",
                exception.getErrorCode().getCode());
            return Map.of();
        }
    }

    /**
     * 장소를 가리키지 않는 항목은 <b>지도를 뒤지지 않는다.</b>
     *
     * <p>{@code summaries.get(null)} 로 쓰면 안 된다 — 요약이 하나도 없을 때 {@code Map.of()} 를
     * 돌려주는데 그 불변 맵은 {@code get(null)} 에 <b>NPE 를 던진다</b> ({@code HashMap} 과 다르다).
     * 항목이 전부 이동인 일정에서 상세 조회가 통째로 죽는 경로였다 (테스트로 잡았다).
     */
    private static PlanPlaceSummaryQueryResult findSummary(
        Map<Long, PlanPlaceSummaryQueryResult> summaries, PlanItem item) {
        Long placeId = placeTargetIdOf(item);
        return placeId == null ? null : summaries.get(placeId);
    }

    /**
     * 장소로 조회할 수 있는 {@code targetId} 만 돌려준다.
     *
     * <p>판정은 {@code PlanItemType} 이 갖고 있다 — {@code WALK} 의 {@code targetId} 는
     * {@code walk_course.id} 라 장소로 조회하면 남의 아이디로 없는 장소를 찾는다.
     */
    private static Long placeTargetIdOf(PlanItem item) {
        return item.itemType().isPlaceTarget() ? item.targetId() : null;
    }

    private PlanInfo toPlanInfo(Plan plan, List<PlanItemInfo> items) {
        return PlanInfo.builder()
            .planId(plan.id())
            .petId(plan.petId())
            .areaCode(plan.areaCode())
            .sigunguCode(plan.sigunguCode())
            .title(plan.title())
            .startDate(plan.startDate())
            .endDate(plan.endDate())
            .budget(plan.budget())
            .status(plan.status())
            .totalDays(plan.totalDays())
            .items(items)
            .build();
    }

    public Slice<PlanSummaryInfo> getMyPlans(long memberId, Long petId, Long lastPlanId, int size) {
        long cursor = lastPlanId == null ? Long.MAX_VALUE : lastPlanId;
        return planRepositoryPort.findMyPlans(memberId, petId, cursor, size)
            .map(this::toSummaryInfo);
    }

    private PlanItemInfo toItemInfo(PlanItem item, PlanPlaceSummaryQueryResult summary) {
        return PlanItemInfo.builder()
            .planItemId(item.id())
            .day(item.day())
            .sequence(item.sequence())
            .itemType(item.itemType())
            .targetId(item.targetId())
            .title(item.title())
            .memo(item.memo())
            .startTime(item.startTime())
            .visited(item.visited())
            .place(toPlaceInfo(summary))
            .build();
    }

    /**
     * 요약이 없으면 null 이다. 노출 불가(병합·delisted) 장소라 목록에서 빠진 경우인데,
     * <b>항목 자체는 남긴다</b> — 사용자가 담아 둔 자료다.
     */
    private PlanItemPlaceInfo toPlaceInfo(PlanPlaceSummaryQueryResult summary) {
        if (summary == null) {
            return null;
        }
        return PlanItemPlaceInfo.builder()
            .addr1(summary.addr())
            .indoor(summary.indoor())
            .firstImage(summary.firstImage())
            .lat(summary.lat())
            .lng(summary.lng())
            .build();
    }

    private PlanSummaryInfo toSummaryInfo(Plan plan) {
        return PlanSummaryInfo.builder()
            .planId(plan.id())
            .petId(plan.petId())
            .areaCode(plan.areaCode())
            .title(plan.title())
            .startDate(plan.startDate())
            .endDate(plan.endDate())
            .status(plan.status())
            .build();
    }
}
