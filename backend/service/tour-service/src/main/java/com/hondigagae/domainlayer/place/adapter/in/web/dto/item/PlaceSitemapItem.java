package com.hondigagae.domainlayer.place.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.Builder;

@Builder
@Schema(description = "사이트맵용 장소 항목")
public record PlaceSitemapItem(

    @Schema(description = "장소 아이디. Snowflake 18자리라 문자열이다", example = "212481712381923328")
    String placeId,

    @Schema(description = "반려동물 동반 구분 metadata. 어느 판정을 색인할지는 사이트맵을 만드는 쪽이 고른다")
    CodeNameDescriptionMetadata petAllowanceType,

    @Schema(
        description = "원천(TourAPI · 문화정보원 등)이 준 수정일(KST). 적재 시각이 아니다 — 배치가 매번 모든 행을 다시 쓰므로 "
            + "적재 시각은 lastmod 로 뜻이 없다. 원천에 수정일이 없으면(식약처 원천 등) null 이고, 그때는 lastmod 를 생략한다",
        example = "2026-08-27T14:30:05", nullable = true)
    LocalDateTime modifiedAt
) {

}
