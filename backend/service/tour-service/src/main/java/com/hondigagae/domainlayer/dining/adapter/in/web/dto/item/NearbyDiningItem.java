package com.hondigagae.domainlayer.dining.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "주변 식음료 항목 DTO")
public record NearbyDiningItem(

    @Schema(description = "상호명", example = "제주 애견동반 식당")
    String name,

    @Schema(description = "주소", example = "제주특별자치도 제주시 애월읍 ...")
    String address,

    @Schema(description = "위도", example = "33.4521283086")
    double lat,

    @Schema(description = "경도", example = "126.7610119406")
    double lng,

    @Schema(description = "전화번호", example = "064-000-0000")
    String phone,

    @Schema(description = "제공처 분류", example = "음식점 > 한식")
    String category,

    @Schema(description = "상세 페이지 링크 (출처 표시용)", example = "http://place.map.kakao.com/000000")
    String detailUrl,

    @Schema(description = "검색 중심점으로부터의 거리(m)", example = "820")
    int distanceMeters
) {
}
