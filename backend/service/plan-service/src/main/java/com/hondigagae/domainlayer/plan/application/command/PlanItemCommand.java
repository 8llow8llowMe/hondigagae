package com.hondigagae.domainlayer.plan.application.command;

import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.LocalTime;
import lombok.Builder;

@Builder
public record PlanItemCommand(
    // 일자별 일괄 교체 경로에서는 경로 변수로 덮어쓰므로 null 로 올 수 있다. 생성 경로는 Processor 가 필수 검증한다.
    Integer day,
    int sequence,
    PlanItemType itemType,
    Long targetId,
    String title,
    String memo,
    LocalTime startTime
) {

}
