package com.hondigagae.domainlayer.place.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceDetailResponse;
import com.hondigagae.domainlayer.place.application.exception.PlaceValidationMessage;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.in.PlaceWebUseCase;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
import com.hondigagae.persistence.dto.SliceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
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

    @Operation(summary = "장소 목록 조회", description = "지역/타입/반려동물 동반 조건으로 장소를 검색합니다. lastPlaceId 커서 기반 무한 스크롤 응답입니다.")
    @GetMapping
    public ResponseEntity<Response<SliceResponse<PlaceItem>>> getPlaces(
        @Parameter(description = "관광 지역코드 (제주=39)", example = "39") @RequestParam(required = false) String areaCode,
        @Parameter(description = "관광 시군구코드", example = "3") @RequestParam(required = false) String sigunguCode,
        @Parameter(description = "콘텐츠 타입") @RequestParam(required = false) ContentType contentType,
        @Parameter(description = "반려동물 동반 구분") @RequestParam(required = false) PetAllowanceType petAllowanceType,
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
            .lastPlaceId(lastPlaceId)
            .size(size)
            .build();
        SliceResponse<PlaceItem> response = placeWebUseCase.getPlaces(criteria);
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
