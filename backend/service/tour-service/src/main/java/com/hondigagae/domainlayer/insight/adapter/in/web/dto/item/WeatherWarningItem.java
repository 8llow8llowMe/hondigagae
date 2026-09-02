package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 발효 중인 기상특보.
 *
 * <p><b>옵셔널 필드다.</b> 특보가 없거나 조회하지 못하면 응답에서 이 필드가 null 이다.
 * 기존 클라이언트는 모르는 필드를 무시하므로 계약이 깨지지 않는다.
 *
 * <p>여러 특보가 동시에 뜨면 <b>가장 무거운 것</b>만 담는다. 판정이 그것으로 이뤄지기 때문이고,
 * 목록을 통째로 내리면 화면이 무엇을 강조해야 할지 알 수 없다.
 */
@Builder
@Schema(description = "기상특보 DTO")
public record WeatherWarningItem(

    @Schema(description = "특보 종류 metadata")
    CodeNameDescriptionMetadata type,

    @Schema(description = "특보 단계 metadata. 경보면 점수를 내지 않고 산책은 위험으로 판정한다")
    CodeNameDescriptionMetadata level,

    @Schema(description = "발효 시각. 원천이 주지 않으면 null", example = "2026-09-02T06:00:00", nullable = true)
    LocalDateTime effectiveAt
) {
}
