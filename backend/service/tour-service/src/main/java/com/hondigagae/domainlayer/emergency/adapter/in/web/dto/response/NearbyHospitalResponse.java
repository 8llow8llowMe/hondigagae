package com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.item.NearbyHospitalItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "주변 동물병원 검색 응답 DTO")
public record NearbyHospitalResponse(

    @Schema(description = "검색 결과 (가까운 순)")
    List<NearbyHospitalItem> hospitals,

    @Schema(description = "결과 수", example = "5")
    int totalCount,

    @Schema(description = "검색 반경(m)", example = "10000")
    int radius,

    @Schema(
        description = "24시간 운영으로 확인된 곳만 걸렀는지. 제주 전체에 3곳뿐이라 true 로 조회하면 결과가 매우 적다",
        example = "false")
    boolean open24Only,

    @Schema(description = "정보 출처", example = "한국문화정보원 반려동물 동반 가능 문화시설 위치 데이터")
    String providerName
) {
}
