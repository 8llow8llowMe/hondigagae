package com.hondigagae.domainlayer.planner.domain.model;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum AiPlanJobStatus implements CodeNameDescribable {

    PENDING("대기 중", "작업이 큐에서 실행을 기다리고 있습니다."),
    RUNNING("생성 중", "AI가 반려견 맞춤 여행 일정을 생성하고 있습니다."),
    COMPLETED("완료", "여행 일정 생성이 완료되었습니다."),
    FAILED("실패", "여행 일정 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");

    private final String displayName;
    private final String description;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED;
    }

    public boolean isInFlight() {
        return this == PENDING || this == RUNNING;
    }
}
