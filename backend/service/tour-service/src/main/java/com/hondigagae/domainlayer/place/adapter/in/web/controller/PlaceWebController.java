package com.hondigagae.domainlayer.place.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.NearbyPlaceResponse;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceDetailResponse;
import com.hondigagae.domainlayer.place.application.exception.PlaceValidationMessage;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceKeyword;
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
import jakarta.validation.constraints.Size;
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
            + "비 오는 날 대안을 찾을 때는 indoor=true 로, 소형견만 받는 곳을 피할 때는 allowedPetSize 로 거릅니다. "
            + "이름·주소로 찾을 때는 keyword 를 씁니다 (부분 일치, 대소문자 무시).\n\n"
            + "**필수 파라미터는 없습니다.** 전부 생략하면 전체 장소의 첫 페이지(20개)가 옵니다. "
            + "선택 파라미터는 채운 것만 AND 조건으로 걸립니다.\n\n"
            + "**정렬은 `placeId` 오름차순이며 최신순이 아닙니다.** 아이디 대역이 원천별로 갈려 있어 "
            + "사진·개요가 있는 관광정보(TourAPI) 장소가 먼저 오고, 이미지가 없는 문화정보원·식약처 장소가 뒤에 옵니다.\n\n"
            + "호출 예\n"
            + "- 제주 음식점·카페 20개: `GET /api/v1/places?areaCode=39&contentType=RESTAURANT`\n"
            + "- 중형견 동반 가능한 실내 장소: `GET /api/v1/places?petAllowanceType=ALLOWED&indoor=true&petSizeType=MEDIUM`\n"
            + "- 성산이 이름이나 주소에 들어간 곳: `GET /api/v1/places?keyword=성산`\n"
            + "- 다음 페이지: 직전 응답 `items` 마지막의 `placeId` 를 `lastPlaceId` 로")
    @GetMapping
    public ResponseEntity<Response<SliceResponse<PlaceItem>>> getPlaces(
        @Parameter(description = "[선택] 관광 지역코드. 제주=39. 생략하면 지역 제한 없음 (현재 적재 데이터는 제주만이라 결과가 같습니다)", example = "39") @RequestParam(required = false) String areaCode,
        @Parameter(description = "[선택] 관광 시군구코드(TourAPI sigunguCode). 생략하면 시군구 제한 없음", example = "3") @RequestParam(required = false) String sigunguCode,
        @Parameter(description = "[선택] 콘텐츠 타입. 생략하면 전체. TOURIST_SPOT 관광지 · CULTURE 문화시설 · FESTIVAL 축제공연행사 · COURSE 여행코스 · LEPORTS 레포츠 · LODGING 숙박 · SHOPPING 쇼핑 · RESTAURANT 음식점(카페 포함)", example = "RESTAURANT") @RequestParam(required = false) ContentType contentType,
        @Parameter(description = "[선택] 반려동물 동반 구분. 생략하면 이 조건으로 걸러내지 않아 NOT_ALLOWED·UNKNOWN 도 함께 나옵니다. 동반 가능한 곳만 보려면 ALLOWED. ALLOWED 동반 가능 · PARTIALLY_ALLOWED 일부 구역/조건부 · NOT_ALLOWED 동반 불가 · UNKNOWN 정보 없음", example = "ALLOWED") @RequestParam(required = false) PetAllowanceType petAllowanceType,
        @Parameter(description = "[선택] 실내 여부. true 면 실내만, false 면 실외만. 생략하면 구분 없음. 원천에 정보가 없는 장소는 true/false 어느 쪽으로도 잡히지 않습니다", example = "true")
        @RequestParam(required = false) Boolean indoor,
        @Parameter(description = "[선택] 장소가 받는 반려동물 크기. 생략하면 필터 없음. ALL 전 견종 · SMALL_ONLY 소형견만 · SMALL_MEDIUM 중소형견 · UNKNOWN 정보 없음. 내 반려견 기준으로 거르려면 이 값 대신 petSizeType 을 쓰는 편이 쉽습니다", example = "ALL") @RequestParam(required = false) AllowedPetSize allowedPetSize,
        @Parameter(description = "[선택] 내 반려견 크기. SMALL 10kg 미만 · MEDIUM 10~25kg · LARGE 25kg 이상. 받아 주지 않는 것으로 확인된 곳만 뺍니다 — 정보 없음인 곳은 남습니다. 생략하면 필터 없음", example = "MEDIUM")
        @RequestParam(required = false) PetSizeType petSizeType,
        @Parameter(description = "[선택] 내 반려견 체중(kg, 1~100). 체중 상한이 명시된 곳(12kg 미만 등)을 정확히 거릅니다. 생략하면 필터 없음", example = "15")
        @Min(value = 1, message = PlaceValidationMessage.PET_WEIGHT_RANGE_INVALID)
        @Max(value = 100, message = PlaceValidationMessage.PET_WEIGHT_RANGE_INVALID)
        @RequestParam(required = false) Integer petWeightKg,
        @Parameter(description = "[선택] 원천 분류명 그대로 (펜션·카페·박물관·여행지 등). 콘텐츠 타입으로는 갈리지 않는 구분에 씁니다. 생략하면 필터 없음", example = "카페")
        @RequestParam(required = false) String sourceCategory,
        @Parameter(description = "[선택] 장소명 또는 주소 부분 일치. 공백/빈 값은 필터 없음. 최대 50자", example = "성산")
        @Size(max = PlaceKeyword.MAX_LENGTH, message = PlaceValidationMessage.KEYWORD_MAX_INVALID)
        @RequestParam(required = false) String keyword,
        @Parameter(description = "[선택] 커서. 첫 페이지는 생략하고, 다음 페이지는 직전 응답 마지막 항목의 placeId 를 넣습니다(그 아이디 **뒤**부터 옵니다). 예시 값은 형식 안내용", example = "126434") @RequestParam(required = false) Long lastPlaceId,
        @Parameter(description = "[선택, 기본 20] 조회 개수 (1~50)", example = "20")
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
            .keyword(keyword)
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
            + "여기 담긴 음식점은 지자체에 반려동물 동반출입 업소로 등록된 곳이라 동반 가능 여부가 확인된 정보입니다.\n\n"
            + "**필수: lat, lng.** 나머지는 생략 가능하고 radius 기본 5000m, size 기본 15 입니다.\n\n"
            + "**totalCount 는 size 로 자르기 전 총계입니다.** 돌려준 개수보다 크면 반경 안에 더 있다는 뜻입니다.\n\n"
            + "호출 예\n"
            + "- 제주시청 반경 3km 카페: `GET /api/v1/places/nearby?lat=33.4996&lng=126.5312&radius=3000&sourceCategory=카페`\n"
            + "- 성산이 이름이나 주소에 들어간 5km 안 장소: `GET /api/v1/places/nearby?lat=33.4996&lng=126.5312&keyword=성산`\n"
            + "- 소형견 동반 가능한 5km 안 장소: `GET /api/v1/places/nearby?lat=33.4996&lng=126.5312&petAllowanceType=ALLOWED&petSizeType=SMALL`")
    @GetMapping("/nearby")
    public ResponseEntity<Response<NearbyPlaceResponse>> getNearbyPlaces(
        @Parameter(description = "[필수] 중심 위도 (WGS84, -90~90)", required = true, example = "33.4996213")
        @Min(value = -90, message = PlaceValidationMessage.LAT_RANGE_INVALID)
        @Max(value = 90, message = PlaceValidationMessage.LAT_RANGE_INVALID)
        @RequestParam Double lat,

        @Parameter(description = "[필수] 중심 경도 (WGS84, -180~180)", required = true, example = "126.5311884")
        @Min(value = -180, message = PlaceValidationMessage.LNG_RANGE_INVALID)
        @Max(value = 180, message = PlaceValidationMessage.LNG_RANGE_INVALID)
        @RequestParam Double lng,

        @Parameter(description = "[선택, 기본 5000] 검색 반경(m). 1~50000", example = "5000")
        @Min(value = 1, message = PlaceValidationMessage.RADIUS_RANGE_INVALID)
        @Max(value = 50_000, message = PlaceValidationMessage.RADIUS_RANGE_INVALID)
        @RequestParam(defaultValue = "5000") int radius,

        @Parameter(description = "[선택] 콘텐츠 타입. 생략하면 전체. TOURIST_SPOT 관광지 · CULTURE 문화시설 · FESTIVAL 축제공연행사 · COURSE 여행코스 · LEPORTS 레포츠 · LODGING 숙박 · SHOPPING 쇼핑 · RESTAURANT 음식점(카페 포함)", example = "RESTAURANT") @RequestParam(required = false) ContentType contentType,
        @Parameter(description = "[선택] 반려동물 동반 구분. 생략하면 이 조건으로 걸러내지 않아 NOT_ALLOWED·UNKNOWN 도 함께 나옵니다. 동반 가능한 곳만 보려면 ALLOWED. ALLOWED 동반 가능 · PARTIALLY_ALLOWED 일부 구역/조건부 · NOT_ALLOWED 동반 불가 · UNKNOWN 정보 없음", example = "ALLOWED") @RequestParam(required = false) PetAllowanceType petAllowanceType,
        @Parameter(description = "[선택] 실내 여부. true 면 실내만, false 면 실외만. 생략하면 구분 없음", example = "true") @RequestParam(required = false) Boolean indoor,
        @Parameter(description = "[선택] 장소가 받는 반려동물 크기. 생략하면 필터 없음. ALL 전 견종 · SMALL_ONLY 소형견만 · SMALL_MEDIUM 중소형견 · UNKNOWN 정보 없음. 내 반려견 기준으로 거르려면 이 값 대신 petSizeType 을 쓰는 편이 쉽습니다", example = "ALL") @RequestParam(required = false) AllowedPetSize allowedPetSize,
        @Parameter(description = "[선택] 내 반려견 크기. SMALL 10kg 미만 · MEDIUM 10~25kg · LARGE 25kg 이상. 받아 주지 않는 것으로 확인된 곳만 뺍니다 — 정보 없음인 곳은 남습니다. 생략하면 필터 없음", example = "MEDIUM")
        @RequestParam(required = false) PetSizeType petSizeType,
        @Parameter(description = "[선택] 내 반려견 체중(kg, 1~100). 체중 상한이 명시된 곳을 정확히 거릅니다. 생략하면 필터 없음", example = "15")
        @Min(value = 1, message = PlaceValidationMessage.PET_WEIGHT_RANGE_INVALID)
        @Max(value = 100, message = PlaceValidationMessage.PET_WEIGHT_RANGE_INVALID)
        @RequestParam(required = false) Integer petWeightKg,
        @Parameter(description = "[선택] 원천 분류명 그대로 (카페·펜션·일반음식점 등). 생략하면 필터 없음", example = "카페")
        @RequestParam(required = false) String sourceCategory,
        @Parameter(description = "[선택] 장소명 또는 주소 부분 일치. 공백/빈 값은 필터 없음. 최대 50자", example = "성산")
        @Size(max = PlaceKeyword.MAX_LENGTH, message = PlaceValidationMessage.KEYWORD_MAX_INVALID)
        @RequestParam(required = false) String keyword,

        @Parameter(description = "[선택, 기본 15] 조회 개수 (1~50)", example = "15")
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
            .keyword(keyword)
            .size(size)
            .build();
        NearbyPlaceResponse response = placeWebUseCase.getNearbyPlaces(criteria);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "장소 상세 조회", description = "장소 기본 정보에 소개(운영시간/주차), 반려동물 동반 정보, 추가 이미지를 결합해 반환합니다.")
    @GetMapping("/{placeId}")
    public ResponseEntity<Response<PlaceDetailResponse>> getPlaceDetail(
        @Parameter(description = "[필수] 장소 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 목록·주변 조회 응답의 placeId 를 그대로 씁니다", required = true, example = "212481712381923328") @PathVariable long placeId
    ) {
        PlaceDetailResponse response = placeWebUseCase.getPlaceDetail(placeId);
        return ResponseEntity.ok().body(Response.success(response));
    }
}
