package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemWalkSafetyItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

/**
 * 일정 항목별 산책 위험도 응답.
 *
 * <p>일자 날씨 브리핑(`GET /plans/{planId}/weather`)과 <b>다른 질문에 답한다.</b> 그쪽은
 * "둘째 날 괜찮아?" 이고 이쪽은 "두 시에 그 해수욕장 걸어도 돼?" 다. 산책 위험도는 시각에
 * 따라 갈리므로 일자로 접을 수 없다.
 *
 * <p>항목별 {@code unavailableReasonCode} 가 따로 있는 것이 이 응답의 요점이다. 어떤 항목은
 * 시각이 없고 어떤 항목은 장소가 아니어서 못 내는 것이 <b>정상</b>이라, 전체를 성공/실패로
 * 나누면 그 차이를 표현할 수 없다.
 */
@Builder
@Schema(description = "일정 항목 산책 위험도 응답 DTO")
public record PlanWalkSafetyResponse(

    @Schema(description = "일정 아이디", example = "1234567890123456789")
    String planId,

    @Schema(description = "일정 제목", example = "몽실이와 제주 2박 3일")
    String planTitle,

    @Schema(description = "판정에 들어간 동행 반려견 아이디 목록. 항목별 basisPetId 는 이 안의 하나다",
        example = "[\"1234567890123456789\"]")
    List<String> petIds,

    @Schema(description = "일차·순서대로 정렬된 항목별 판정. 못 낸 항목도 사유와 함께 그대로 들어간다")
    List<PlanItemWalkSafetyItem> items
) {
}
