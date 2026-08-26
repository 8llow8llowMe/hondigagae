package com.hondigagae.domainlayer.dining.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.dining.adapter.in.web.dto.item.NearbyDiningItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "주변 식음료 검색 응답 DTO")
public record NearbyDiningResponse(

    @Schema(description = "검색 결과 (가까운 순)")
    List<NearbyDiningItem> places,

    @Schema(description = "결과 수", example = "12")
    int totalCount,

    @Schema(description = "정보 출처", example = "카카오맵")
    String providerName,

    @Schema(
        description = "반려견 동반 가능 여부가 확인된 값인지. 이 검색은 지도 검색 결과라 항상 false 다 — "
            + "화면에서 \"동반 가능\"으로 단정하지 말고 직접 확인이 필요하다고 안내해야 한다",
        example = "false")
    boolean petPolicyVerified
) {
}
