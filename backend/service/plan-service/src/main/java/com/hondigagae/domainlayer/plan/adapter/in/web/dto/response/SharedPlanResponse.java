package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.SharedPlanItemItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 공유 링크로 열리는 일정 (이슈 #627). <b>비인증 응답이다.</b>
 *
 * <p><b>{@link PlanDetailResponse} 에서 의도적으로 뺀 것</b>:
 * <ul>
 *   <li>{@code planId} — 이것이 있으면 받은 사람이 소유자 API({@code /api/v1/plans/{planId}})를
 *       찍어 볼 수 있는 실마리가 된다. 공유 조회에 필요하지도 않다
 *   <li>{@code petId}·{@code petIds} — 남의 반려견 아이디는 공유 대상이 아니다
 *   <li>{@code budget} — 예산은 사적인 값이다. "링크를 줬다" 가 "예산을 보여 줬다" 가 되면 안 된다
 * </ul>
 *
 * <p>준비물·후기·응급 브리핑은 애초에 상세 응답에 없고 각자 별도 API 라 여기에도 없다.
 *
 * <p>필드를 더하기 전에 {@code PlanShareLinkPresenterTest} 가 고정한 이름 집합을 먼저 본다.
 */
@Builder
@Schema(description = "공유된 여행 일정 응답 DTO (읽기 전용, 비인증)")
public record SharedPlanResponse(

    @Schema(description = "일정 제목", example = "몽실이와 제주 2박 3일")
    String title,

    @Schema(description = "지역 코드", example = "39")
    String areaCode,

    @Schema(description = "시군구 코드", example = "4", nullable = true)
    String sigunguCode,

    @Schema(description = "여행 시작일", example = "2026-09-12")
    LocalDate startDate,

    @Schema(description = "여행 종료일", example = "2026-09-14")
    LocalDate endDate,

    @Schema(description = "총 여행 일수", example = "3")
    int totalDays,

    @Schema(description = "일정 상태 (공유되는 것은 확정·완료뿐이다)",
        example = "{\"code\":\"CONFIRMED\",\"name\":\"확정\",\"description\":\"여행이 확정된 일정입니다.\"}")
    CodeNameDescriptionMetadata status,

    @Schema(description = "일정 항목 목록 (일차·순서 오름차순)")
    List<SharedPlanItemItem> items
) {
}
