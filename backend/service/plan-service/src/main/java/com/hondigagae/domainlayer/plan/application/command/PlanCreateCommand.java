package com.hondigagae.domainlayer.plan.application.command;

import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * @param petIds 동행 반려견. 첫 번째가 대표 반려견이다. 비어 있으면 Processor 가 대표 반려견으로
 *               채운다 — 요청 DTO 의 petId/petIds 우선순위 정리는 DTO 가 이미 끝냈다
 * @param sourceAiJobId AI 초안을 담을 때의 작업 아이디(담기 멱등 키, #970). 일반 생성은 {@code null}
 */
@Builder
public record PlanCreateCommand(
    List<Long> petIds,
    String areaCode,
    String sigunguCode,
    String title,
    LocalDate startDate,
    LocalDate endDate,
    Integer budget,
    List<PlanItemCommand> items,
    String sourceAiJobId
) {

}
