package com.hondigagae.domainlayer.place.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.NearbyPlaceItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "주변 장소 검색 응답 DTO")
public record NearbyPlaceResponse(

    @Schema(description = "검색 결과 (가까운 순)")
    List<NearbyPlaceItem> places,

    @Schema(
        description = "반경 안에서 조건에 맞는 장소의 **총** 개수. size 로 자르기 **전** 값이라 "
            + "places 개수보다 클 수 있고, 그 차이가 \"더 있다\"는 뜻이다",
        example = "34")
    int totalCount,

    @Schema(description = "검색 반경(m)", example = "5000")
    int radius
) {
}
