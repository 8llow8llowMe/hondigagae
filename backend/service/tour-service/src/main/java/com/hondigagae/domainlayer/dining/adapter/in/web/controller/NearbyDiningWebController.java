package com.hondigagae.domainlayer.dining.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.dining.adapter.in.web.dto.response.NearbyDiningResponse;
import com.hondigagae.domainlayer.dining.application.exception.DiningValidationMessage;
import com.hondigagae.domainlayer.dining.application.model.NearbyDiningQuery;
import com.hondigagae.domainlayer.dining.application.port.in.NearbyDiningWebUseCase;
import com.hondigagae.domainlayer.dining.domain.enums.DiningType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/places")
@Tag(name = "주변 식음료", description = "지도 검색으로 주변 식당·카페를 실시간 조회합니다. 저장하지 않고 매번 새로 받아옵니다.")
public class NearbyDiningWebController {

    private final NearbyDiningWebUseCase nearbyDiningWebUseCase;

    @Operation(summary = "주변 식당·카페 검색",
        description = "좌표 기준 반경 안의 식당·카페를 찾습니다. 반려견 동반 정보를 가진 공공데이터에 제주 식당이 없어 "
            + "지도 검색으로 후보만 제시하는 기능입니다. "
            + "응답의 petPolicyVerified 는 항상 false 이며, 동반 가능 여부는 사용자가 직접 확인해야 합니다. "
            + "제공처 정책상 결과를 저장하지 않으므로 화면을 열 때마다 새로 호출해야 합니다.")
    @GetMapping("/nearby-dining")
    public ResponseEntity<Response<NearbyDiningResponse>> searchNearbyDining(
        @Parameter(description = "중심 위도", required = true, example = "33.4521283086")
        @NotNull(message = DiningValidationMessage.LAT_REQUIRED)
        @Min(value = -90, message = DiningValidationMessage.LAT_RANGE_INVALID)
        @Max(value = 90, message = DiningValidationMessage.LAT_RANGE_INVALID)
        @RequestParam Double lat,

        @Parameter(description = "중심 경도", required = true, example = "126.7610119406")
        @NotNull(message = DiningValidationMessage.LNG_REQUIRED)
        @Min(value = -180, message = DiningValidationMessage.LNG_RANGE_INVALID)
        @Max(value = 180, message = DiningValidationMessage.LNG_RANGE_INVALID)
        @RequestParam Double lng,

        @Parameter(description = "검색 반경(m). 최대 20000", example = "2000")
        @Min(value = 1, message = DiningValidationMessage.RADIUS_RANGE_INVALID)
        @Max(value = 20_000, message = DiningValidationMessage.RADIUS_RANGE_INVALID)
        @RequestParam(defaultValue = "2000") int radius,

        @Parameter(description = "검색 종류", example = "RESTAURANT")
        @RequestParam(defaultValue = "RESTAURANT") DiningType type,

        @Parameter(description = "검색어. 생략하면 종류로만 찾는다", example = "애견동반")
        @RequestParam(required = false) String keyword,

        @Parameter(description = "조회 개수 (1~15)", example = "15")
        @Min(value = 1, message = DiningValidationMessage.SIZE_RANGE_INVALID)
        @Max(value = 15, message = DiningValidationMessage.SIZE_RANGE_INVALID)
        @RequestParam(defaultValue = "15") int size
    ) {
        NearbyDiningQuery query = NearbyDiningQuery.builder()
            .lat(lat)
            .lng(lng)
            .radius(radius)
            .diningType(type)
            .keyword(keyword)
            .size(size)
            .build();

        NearbyDiningResponse response = nearbyDiningWebUseCase.searchNearby(query);
        return ResponseEntity.ok().body(Response.success(response));
    }
}
