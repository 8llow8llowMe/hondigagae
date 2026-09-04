package com.hondigagae.domainlayer.planner.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "AI 추천 이유 항목 DTO (XAI — api-design-guide §9)")
public record AiPlanReasonItem(

    @Schema(description = "이유 코드. PET_ALLOWED 반려견 동반 가능 · WEATHER_OK 날씨 양호 · LOW_CONGESTION 한산 · INDOOR_ALTERNATIVE 실내 대안 · SHORT_DISTANCE 짧은 이동 · REST_SLOT 휴식 시간 확보", example = "PET_ALLOWED")
    String code,

    @Schema(description = "이유 이름 (화면 표시용 짧은 문구)", example = "반려견 동반 가능")
    String name,

    @Schema(description = "데이터 근거 설명. 일반론이 아니라 이 여행의 데이터에 근거한 한두 문장", example = "추천 장소는 모두 반려견 출입이 가능한 시설로만 구성했습니다.")
    String description
) {

}
