package com.hondigagae.domainlayer.emergency.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.NearbyFacilityResponse;
import com.hondigagae.domainlayer.emergency.application.exception.EmergencyValidationMessage;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.in.NearbyFacilityWebUseCase;
import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
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
@RequestMapping("/api/v1/emergencies")
@Tag(name = "긴급 시설", description = "여행 중 반려견에게 문제가 생겼을 때 필요한 시설을 찾습니다.")
public class NearbyFacilityWebController {

    private final NearbyFacilityWebUseCase nearbyFacilityWebUseCase;

    @Operation(summary = "주변 긴급 시설 검색",
        description = "좌표 기준 반경 안의 동물병원·동물약국을 가까운 순으로 찾습니다. "
            + "type 을 비우면 둘이 섞여 나옵니다 — 급할 때 필요한 것은 가장 가까운 도움이지 "
            + "가장 가까운 병원이 아니기 때문입니다. "
            + "operatingHoursKnown 이 false 인 항목은 \"휴무\"가 아니라 \"영업 정보 없음\"이므로 "
            + "전화 확인을 안내해야 합니다(동물병원은 약 절반이 운영시간을 주지 않습니다). "
            + "24시간 운영이 확인된 곳은 제주 동물병원 중 3곳뿐이라 open24Only=true 는 결과가 매우 적습니다.")
    @GetMapping("/facilities")
    public ResponseEntity<Response<NearbyFacilityResponse>> searchNearbyFacilities(
        @Parameter(description = "중심 위도", required = true, example = "33.4996213")
        @NotNull
        @Min(value = -90, message = EmergencyValidationMessage.LAT_RANGE_INVALID)
        @Max(value = 90, message = EmergencyValidationMessage.LAT_RANGE_INVALID)
        @RequestParam Double lat,

        @Parameter(description = "중심 경도", required = true, example = "126.5311884")
        @NotNull
        @Min(value = -180, message = EmergencyValidationMessage.LNG_RANGE_INVALID)
        @Max(value = 180, message = EmergencyValidationMessage.LNG_RANGE_INVALID)
        @RequestParam Double lng,

        @Parameter(description = "검색 반경(m). 최대 50000", example = "10000")
        @Min(value = 1, message = EmergencyValidationMessage.RADIUS_RANGE_INVALID)
        @Max(value = 50_000, message = EmergencyValidationMessage.RADIUS_RANGE_INVALID)
        @RequestParam(defaultValue = "10000") int radius,

        @Parameter(description = "시설 종류. 비우면 동물병원과 동물약국을 함께 본다", example = "ANIMAL_HOSPITAL")
        @RequestParam(required = false) EmergencyFacilityType type,

        @Parameter(description = "24시간 운영으로 확인된 곳만 볼지", example = "false")
        @RequestParam(defaultValue = "false") boolean open24Only,

        @Parameter(description = "조회 개수 (1~50)", example = "10")
        @Min(value = 1, message = EmergencyValidationMessage.SIZE_RANGE_INVALID)
        @Max(value = 50, message = EmergencyValidationMessage.SIZE_RANGE_INVALID)
        @RequestParam(defaultValue = "10") int size
    ) {
        NearbyFacilityQuery query = NearbyFacilityQuery.builder()
            .lat(lat)
            .lng(lng)
            .radius(radius)
            .facilityType(type)
            .open24Only(open24Only)
            .size(size)
            .build();

        NearbyFacilityResponse response = nearbyFacilityWebUseCase.searchNearby(query);
        return ResponseEntity.ok().body(Response.success(response));
    }
}
