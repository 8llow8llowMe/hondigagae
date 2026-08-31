package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import java.time.LocalTime;
import lombok.Builder;

@Builder
public record PlanItemInfo(
    long planItemId,
    int day,
    int sequence,
    PlanItemType itemType,
    Long targetId,
    String title,
    String memo,
    LocalTime startTime,
    boolean visited,
    /**
     * 항목이 가리키는 장소 요약 (이슈 #86). 장소를 가리키지 않는 항목(WALK·MOVE)이거나
     * 원천에서 사라진 장소면 null 이다 — <b>그때도 항목 자체는 남는다.</b>
     */
    PlanItemPlaceInfo place
) {

}
