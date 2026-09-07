package com.hondigagae.domainlayer.emergency.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.EmergencyFacilityDetailResponse;
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
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
            + "24시간 운영이 확인된 곳은 제주 동물병원 중 3곳뿐이라 open24Only=true 는 결과가 매우 적습니다.\n\n"
            + "**필수: lat, lng.** 나머지는 생략 가능하고 radius 기본 10000m, size 기본 10 입니다.\n\n"
            + "**totalCount 는 size 로 자르기 전 총계입니다.** 돌려준 개수보다 클 수 있고, "
            + "그때는 `facilities.length < totalCount` 가 참이 되어 잘렸음을 알 수 있습니다.\n\n"
            + "호출 예\n"
            + "- 가장 가까운 도움 10곳: `GET /api/v1/emergencies/facilities?lat=33.4996&lng=126.5312`\n"
            + "- 지금 영업 중인 동물병원만: `GET /api/v1/emergencies/facilities?lat=33.4996&lng=126.5312&type=ANIMAL_HOSPITAL&openNowOnly=true`")
    @GetMapping("/facilities")
    public ResponseEntity<Response<NearbyFacilityResponse>> searchNearbyFacilities(
        @Parameter(description = "[필수] 중심 위도 (WGS84, -90~90)", required = true, example = "33.4996213")
        @Min(value = -90, message = EmergencyValidationMessage.LAT_RANGE_INVALID)
        @Max(value = 90, message = EmergencyValidationMessage.LAT_RANGE_INVALID)
        @RequestParam Double lat,

        @Parameter(description = "[필수] 중심 경도 (WGS84, -180~180)", required = true, example = "126.5311884")
        @Min(value = -180, message = EmergencyValidationMessage.LNG_RANGE_INVALID)
        @Max(value = 180, message = EmergencyValidationMessage.LNG_RANGE_INVALID)
        @RequestParam Double lng,

        @Parameter(description = "[선택, 기본 10000] 검색 반경(m). 1~50000", example = "10000")
        @Min(value = 1, message = EmergencyValidationMessage.RADIUS_RANGE_INVALID)
        @Max(value = 50_000, message = EmergencyValidationMessage.RADIUS_RANGE_INVALID)
        @RequestParam(defaultValue = "10000") int radius,

        @Parameter(description = "[선택] 시설 종류. ANIMAL_HOSPITAL 동물병원(진료) · ANIMAL_PHARMACY 동물약국(상비약·처방약). 생략하면 둘을 함께 봅니다", example = "ANIMAL_HOSPITAL")
        @RequestParam(required = false) EmergencyFacilityType type,

        @Parameter(description = "[선택, 기본 false] 24시간 운영으로 확인된 곳만 볼지. 제주 동물병원 중 3곳뿐이라 결과가 매우 적습니다", example = "false")
        @RequestParam(defaultValue = "false") boolean open24Only,

        @Parameter(description = "[선택, 기본 false] 지금 영업 중으로 확인된 곳만 볼지. 영업시간을 모르는 곳(operatingHoursKnown=false)도 "
            + "함께 빠지므로 결과가 줄어듭니다", example = "false")
        @RequestParam(defaultValue = "false") boolean openNowOnly,

        @Parameter(description = "[선택, 기본 10] 조회 개수 (1~250). 제주 전역 시설이 214곳이라 "
            + "250 이면 반경을 최대(50km)로 넓혀도 잘리지 않습니다 — 화면에서 유형·24시간을 좁히며 "
            + "개수를 함께 보여주려면 한 번에 전량을 받아야 하기 때문입니다", example = "10")
        @Min(value = 1, message = EmergencyValidationMessage.SIZE_RANGE_INVALID)
        @Max(value = 250, message = EmergencyValidationMessage.SIZE_RANGE_INVALID)
        @RequestParam(defaultValue = "10") int size
    ) {
        NearbyFacilityQuery query = NearbyFacilityQuery.builder()
            .lat(lat)
            .lng(lng)
            .radius(radius)
            .facilityType(type)
            .open24Only(open24Only)
            .openNowOnly(openNowOnly)
            .size(size)
            .build();

        NearbyFacilityResponse response = nearbyFacilityWebUseCase.searchNearby(query);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "긴급 시설 상세",
        description = "목록에서 고른 시설 한 곳의 상세를 봅니다. "
            + "목록이 내려주는 facilityId 를 그대로 씁니다. "
            + "openNow / operatingHoursKnown 의 뜻은 목록과 같습니다 — 판정 규칙을 한곳에 두어 "
            + "두 화면이 같은 시설을 다르게 말하지 않게 했습니다. "
            + "원천에서 내려간(폐업 등) 시설은 404 입니다. 목록에 없는 곳을 상세로만 볼 수 있으면 "
            + "폐업한 병원 주소를 들고 찾아가게 되기 때문입니다.")
    @GetMapping("/facilities/{facilityId}")
    public ResponseEntity<Response<EmergencyFacilityDetailResponse>> getFacilityDetail(
        @Parameter(description = "[필수] 긴급 시설 아이디. 주변 검색 응답의 facilityId 를 그대로 씁니다. 예시 값은 형식 안내용", required = true, example = "4611686018427387904")
        @PathVariable long facilityId
    ) {
        EmergencyFacilityDetailResponse response = nearbyFacilityWebUseCase.getFacilityDetail(facilityId);
        return ResponseEntity.ok().body(Response.success(response));
    }
}
