package com.hondigagae.domainlayer.place.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.NearbyPlaceResponse;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceDetailResponse;
import com.hondigagae.domainlayer.place.application.exception.PlaceValidationMessage;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.in.PlaceWebUseCase;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import com.hondigagae.persistence.dto.SliceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
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
@RequestMapping("/api/v1/places")
@Tag(name = "장소", description = "반려동물 동반 조건 기반 장소 검색과 상세 조회 API를 제공합니다.")
public class PlaceWebController {

    private final PlaceWebUseCase placeWebUseCase;

    @Operation(summary = "장소 목록 조회",
        description = "지역·타입·반려동물 동반 조건으로 장소를 검색합니다. lastPlaceId 커서 기반 무한 스크롤 응답입니다. "
            + "비 오는 날 대안을 찾을 때는 indoor=true 로, 소형견만 받는 곳을 피할 때는 allowedPetSize 로 거릅니다.")
    @GetMapping
    public ResponseEntity<Response<SliceResponse<PlaceItem>>> getPlaces(
        @Parameter(description = "관광 지역코드 (제주=39)", example = "39") @RequestParam(required = false) String areaCode,
        @Parameter(description = "관광 시군구코드", example = "3") @RequestParam(required = false) String sigunguCode,
        @Parameter(description = "콘텐츠 타입") @RequestParam(required = false) ContentType contentType,
        @Parameter(description = "반려동물 동반 구분") @RequestParam(required = false) PetAllowanceType petAllowanceType,
        @Parameter(description = "실내 여부 — true 면 실내만. 원천에 정보가 없는 장소는 어느 쪽으로도 잡히지 않는다", example = "true")
        @RequestParam(required = false) Boolean indoor,
        @Parameter(description = "입장 가능 반려동물 크기") @RequestParam(required = false) AllowedPetSize allowedPetSize,
        @Parameter(description = "내 반려견 크기. 받아 주지 않는 것으로 확인된 곳만 뺀다 — 정보 없음인 곳은 남는다", example = "MEDIUM")
        @RequestParam(required = false) PetSizeType petSizeType,
        @Parameter(description = "내 반려견 체중(kg). 체중 상한이 명시된 곳(12kg 미만 등)을 정확히 거른다", example = "15")
        @Min(value = 1, message = PlaceValidationMessage.PET_WEIGHT_RANGE_INVALID)
        @Max(value = 100, message = PlaceValidationMessage.PET_WEIGHT_RANGE_INVALID)
        @RequestParam(required = false) Integer petWeightKg,
        @Parameter(description = "원본 분류 (펜션·카페·박물관·여행지 등). 콘텐츠 타입으로는 갈리지 않는 구분에 쓴다", example = "카페")
        @RequestParam(required = false) String sourceCategory,
        @Parameter(description = "커서 — 직전 응답 마지막 placeId", example = "212481712381923328") @RequestParam(required = false) Long lastPlaceId,
        @Parameter(description = "조회 개수 (1~50)", example = "20")
        @Positive(message = PlaceValidationMessage.SIZE_POSITIVE) @Max(value = 50, message = PlaceValidationMessage.SIZE_MAX_INVALID)
        @RequestParam(defaultValue = "20") int size
    ) {
        PlaceSearchCriteria criteria = PlaceSearchCriteria.builder()
            .areaCode(areaCode)
            .sigunguCode(sigunguCode)
            .contentType(contentType)
            .petAllowanceType(petAllowanceType)
            .indoor(indoor)
            .allowedPetSize(allowedPetSize)
            .petSizeType(petSizeType)
            .petWeightKg(petWeightKg)
            .sourceCategory(sourceCategory)
            .lastPlaceId(lastPlaceId)
            .size(size)
            .build();
        SliceResponse<PlaceItem> response = placeWebUseCase.getPlaces(criteria);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "주변 장소 검색",
        description = "좌표 기준 반경 안의 장소를 가까운 순으로 찾습니다. 여행 중 다음 일정을 고를 때 쓰는 조회라 "
            + "커서가 아니라 상위 N 개를 돌려줍니다. "
            + "식사할 곳을 찾을 때는 contentType=RESTAURANT 로, 카페만 볼 때는 sourceCategory=카페 를 함께 씁니다. "
            + "여기 담긴 음식점은 지자체에 반려동물 동반출입 업소로 등록된 곳이라 동반 가능 여부가 확인된 정보입니다.")
    @GetMapping("/nearby")
    public ResponseEntity<Response<NearbyPlaceResponse>> getNearbyPlaces(
        @Parameter(description = "중심 위도", required = true, example = "33.4996213")
        @Min(value = -90, message = PlaceValidationMessage.LAT_RANGE_INVALID)
        @Max(value = 90, message = PlaceValidationMessage.LAT_RANGE_INVALID)
        @RequestParam Double lat,

        @Parameter(description = "중심 경도", required = true, example = "126.5311884")
        @Min(value = -180, message = PlaceValidationMessage.LNG_RANGE_INVALID)
        @Max(value = 180, message = PlaceValidationMessage.LNG_RANGE_INVALID)
        @RequestParam Double lng,

        @Parameter(description = "검색 반경(m). 최대 50000", example = "5000")
        @Min(value = 1, message = PlaceValidationMessage.RADIUS_RANGE_INVALID)
        @Max(value = 50_000, message = PlaceValidationMessage.RADIUS_RANGE_INVALID)
        @RequestParam(defaultValue = "5000") int radius,

        @Parameter(description = "콘텐츠 타입") @RequestParam(required = false) ContentType contentType,
        @Parameter(description = "반려동물 동반 구분") @RequestParam(required = false) PetAllowanceType petAllowanceType,
        @Parameter(description = "실내 여부 — true 면 실내만") @RequestParam(required = false) Boolean indoor,
        @Parameter(description = "입장 가능 반려동물 크기") @RequestParam(required = false) AllowedPetSize allowedPetSize,
        @Parameter(description = "내 반려견 크기", example = "MEDIUM")
        @RequestParam(required = false) PetSizeType petSizeType,
        @Parameter(description = "내 반려견 체중(kg)", example = "15")
        @Min(value = 1, message = PlaceValidationMessage.PET_WEIGHT_RANGE_INVALID)
        @Max(value = 100, message = PlaceValidationMessage.PET_WEIGHT_RANGE_INVALID)
        @RequestParam(required = false) Integer petWeightKg,
        @Parameter(description = "원본 분류 (카페·펜션·일반음식점 등)", example = "카페")
        @RequestParam(required = false) String sourceCategory,

        @Parameter(description = "조회 개수 (1~50)", example = "15")
        @Positive(message = PlaceValidationMessage.SIZE_POSITIVE)
        @Max(value = 50, message = PlaceValidationMessage.SIZE_MAX_INVALID)
        @RequestParam(defaultValue = "15") int size
    ) {
        NearbyPlaceCriteria criteria = NearbyPlaceCriteria.builder()
            .lat(lat)
            .lng(lng)
            .radius(radius)
            .contentType(contentType)
            .petAllowanceType(petAllowanceType)
            .indoor(indoor)
            .allowedPetSize(allowedPetSize)
            .petSizeType(petSizeType)
            .petWeightKg(petWeightKg)
            .sourceCategory(sourceCategory)
            .size(size)
            .build();
        NearbyPlaceResponse response = placeWebUseCase.getNearbyPlaces(criteria);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "장소 상세 조회", description = "장소 기본 정보에 소개(운영시간/주차), 반려동물 동반 정보, 추가 이미지를 결합해 반환합니다.")
    @GetMapping("/{placeId}")
    public ResponseEntity<Response<PlaceDetailResponse>> getPlaceDetail(
        @Parameter(description = "장소 아이디", required = true, example = "212481712381923328") @PathVariable long placeId
    ) {
        PlaceDetailResponse response = placeWebUseCase.getPlaceDetail(placeId);
        return ResponseEntity.ok().body(Response.success(response));
    }
}
