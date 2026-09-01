package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import lombok.Builder;

/**
 * 날짜 하나의 혼잡도.
 *
 * <p>{@code CongestionItem} 과 달리 날짜를 갖는다. 범위 조회의 답은 "얼마나 붐비나"가 아니라
 * <b>"언제 덜 붐비나"</b> 라서, 날짜가 없으면 값 자체가 쓸모없다.
 */
@Builder
@Schema(description = "일자별 혼잡도 예측 DTO")
public record DailyCongestionItem(

    @Schema(description = "예측 일자", example = "2026-09-05")
    LocalDate date,

    @Schema(description = "혼잡도 등급 metadata. 연결된 데이터가 없으면 UNKNOWN 이다")
    CodeNameDescriptionMetadata level,

    @Schema(
        description = "관광지 집중률(0~100). 등급이 UNKNOWN 이면 null 이며, 이는 한산하다는 뜻이 아니라 데이터가 없다는 뜻이다",
        example = "37.2")
    Double concentrationRate
) {
}
