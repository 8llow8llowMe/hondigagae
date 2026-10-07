package com.hondigagae.domainlayer.place.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceSitemapItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "사이트맵용 장소 목록 응답 DTO")
public record PlaceSitemapResponse(

    @Schema(description = "노출 가능한 장소 전량 (placeId 오름차순). 병합·원천에서 사라진 장소는 없다")
    List<PlaceSitemapItem> places,

    @Schema(description = "places 개수. 페이지 없이 전량이라 곧 총계다", example = "2323")
    int totalCount
) {
}
