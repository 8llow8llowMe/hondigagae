package com.hondigagae.domainlayer.plan.adapter.in.internal.presenter;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse.DayOutline;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse.ItemOutline;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class PlanInternalPresenter {

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

    private ItemOutline toItemOutline(PlanItemInfo item) {
        return ItemOutline.builder()
            .title(item.title())
            .itemType(item.itemType() == null ? null : item.itemType().name())
            .placeId(item.targetId())
            .build();
    }
}
