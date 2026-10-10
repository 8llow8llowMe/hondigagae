package com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.item.NearbyFacilityItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "주변 긴급 시설 검색 응답 DTO")
public record NearbyFacilityResponse(

    @Schema(description = "검색 결과 (가까운 순). 종류를 지정하지 않으면 동물병원과 동물약국이 섞여 나온다")
    List<NearbyFacilityItem> facilities,

    @Schema(
        description = "반경 안에서 조건에 맞는 시설의 **총** 개수. size 로 자르기 **전** 값이라 "
            + "facilities 개수보다 클 수 있고, 그 차이가 \"더 있다\"는 뜻이다 — "
            + "`facilities.length < totalCount` 로 잘림을 판정하면 된다",
        example = "137")
    int totalCount,

    @Schema(description = "검색 반경(m)", example = "10000")
    int radius,

    @Schema(
        description = "24시간 운영으로 확인된 곳만 걸렀는지. 제주 동물병원 중 3곳뿐이라 true 로 조회하면 결과가 매우 적다",
        example = "false")
    boolean open24Only,

    @Schema(description = "정보 출처", example = "한국문화정보원 반려동물 동반 가능 문화시설 위치 데이터")
    String providerName
) {
}
