package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "혼잡도 예측 DTO")
public record CongestionItem(

    @Schema(description = "혼잡도 등급 metadata. 연결된 데이터가 없으면 UNKNOWN 이다")
    CodeNameDescriptionMetadata level,

    @Schema(
        description = "관광지 집중률(0~100). 등급이 UNKNOWN 이면 null 이며, 이는 한산하다는 뜻이 아니라 데이터가 없다는 뜻이다",
        example = "37.2")
    Double concentrationRate
) {
}
