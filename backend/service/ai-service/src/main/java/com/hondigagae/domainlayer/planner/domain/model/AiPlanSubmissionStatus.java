package com.hondigagae.domainlayer.planner.domain.model;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum AiPlanSubmissionStatus implements CodeNameDescribable {

    ACCEPTED("작업 접수됨", "일정 생성 작업이 접수되었습니다. 작업 상태 조회 API로 완료 여부를 확인해 주세요.");

    private final String displayName;
    private final String description;
}
