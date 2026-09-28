package com.hondigagae.domainlayer.plan.adapter.in.internal.presenter;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanAiCommitResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanCompanionReconcileResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse.DayOutline;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse.ItemOutline;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.model.PlanCompanionReconcileCounts;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class PlanInternalPresenter {

    /** 결과를 설명하는 세 값만 내보낸다 — 옛 일정 건너뜀·원격 왕복 수는 plan 내부의 관측 지표다. */
    public PlanCompanionReconcileResponse toReconcileResponse(PlanCompanionReconcileCounts counts) {
        return PlanCompanionReconcileResponse.builder()
            .detached(counts.detached())
            .representativeChanged(counts.representativeChanged())
            .placeholderKept(counts.placeholderKept())
            .build();
    }

    /** 일차 오름차순, 일차 안에서는 sequence 순으로 정리해 넘긴다 — 프롬프트에 그대로 실리는 순서다. */
    public PlanOutlineResponse toOutlineResponse(PlanInfo info) {
        Map<Integer, List<PlanItemInfo>> byDay = info.items().stream()
            .collect(Collectors.groupingBy(PlanItemInfo::day, TreeMap::new, Collectors.toList()));

        List<DayOutline> days = byDay.entrySet().stream()
            .map(entry -> DayOutline.builder()
                .day(entry.getKey())
                .items(entry.getValue().stream()
                    .sorted(Comparator.comparingInt(PlanItemInfo::sequence))
                    .map(this::toItemOutline)
                    .toList())
                .build())
            .toList();

        return PlanOutlineResponse.builder()
            .planId(info.planId())
            .petId(info.petId())
            .petIds(info.petIds())
            .startDate(info.startDate() == null ? null : info.startDate().toString())
            .endDate(info.endDate() == null ? null : info.endDate().toString())
            .areaCode(info.areaCode())
            .days(days)
            .build();
    }

    /** @param planId 담은 일정. 없으면 {@code null} 그대로 싣는다 — 404 가 아니다 ({@link PlanAiCommitResponse}) */
    public PlanAiCommitResponse toAiCommitResponse(Long planId) {
        return PlanAiCommitResponse.builder()
            .planId(planId)
            .build();
    }

    private ItemOutline toItemOutline(PlanItemInfo item) {
        return ItemOutline.builder()
            .title(item.title())
            .itemType(item.itemType() == null ? null : item.itemType().name())
            .placeId(item.targetId())
            .build();
    }
}
