package com.hondigagae.domainlayer.planner.adapter.out.client;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PinnedPlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceCandidateInternalClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.MetadataClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.PlaceItemClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.model.PetAdmission;
import com.hondigagae.domainlayer.planner.application.port.out.PlaceCandidateQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import com.hondigagae.shared.travel.pet.PetSizeType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceCandidateClientAdapter implements PlaceCandidateQueryPort {

    /** 동반 가능이 확인된 곳만 후보로 준다. UNKNOWN 을 섞으면 LLM 이 그것을 가능으로 읽는다. */
    private static final String PET_ALLOWED = PetAllowanceType.ALLOWED.name();

    /** tour-service {@code ContentType.LODGING} 의 이름. 공용 enum 이 없어 값을 적는다 (#1236). */
    private static final String CONTENT_TYPE_LODGING = "LODGING";

    /** tour-service {@code ContentType.RESTAURANT}(카페 포함)의 이름 (#1245). */
    private static final String CONTENT_TYPE_RESTAURANT = "RESTAURANT";

    /** tour-service 검색 {@code petWeightKg} 의 범위 ({@code @Min(1) @Max(100)}, #1420). 넘으면 400 이 난다. */
    private static final int SEARCH_WEIGHT_MIN_KG = 1;
    private static final int SEARCH_WEIGHT_MAX_KG = 100;

    private final PlaceCandidateClient placeCandidateClient;
    private final PinnedPlaceCandidateClient pinnedPlaceCandidateClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<PlaceCandidateQueryResult> findPetFriendlyCandidates(String areaCode, String sigunguCode, int size, PetAdmission admission) {
        return search(areaCode, sigunguCode, size, null, null, null, admission);
    }

    @Override
    public List<PlaceCandidateQueryResult> findRequestedCandidates(
        String areaCode, String sigunguCode, int size, Boolean indoor, String sourceCategory, PetAdmission admission
    ) {
        return search(areaCode, sigunguCode, size, indoor, sourceCategory, null, admission);
    }

    @Override
    public List<PlaceCandidateQueryResult> findLodgingCandidates(String areaCode, String sigunguCode, int size, PetAdmission admission) {
        return search(areaCode, sigunguCode, size, null, null, CONTENT_TYPE_LODGING, admission);
    }

    @Override
    public List<PlaceCandidateQueryResult> findRestaurantCandidates(String areaCode, String sigunguCode, int size, PetAdmission admission) {
        return search(areaCode, sigunguCode, size, null, null, CONTENT_TYPE_RESTAURANT, admission);
    }

    @Override
    public List<PlaceCandidateQueryResult> findNearbyCandidates(String areaCode, double lat, double lng, int size, PetAdmission admission) {
        return search(areaCode, null, size, null, null, null, lat, lng, admission);
    }

    @Override
    public List<PlaceCandidateQueryResult> findNearbyLodgingCandidates(
        String areaCode, double lat, double lng, int size, PetAdmission admission
    ) {
        return search(areaCode, null, size, null, null, CONTENT_TYPE_LODGING, lat, lng, admission);
    }

    @Override
    public List<PlaceCandidateQueryResult> findNearbyRestaurantCandidates(
        String areaCode, double lat, double lng, int size, PetAdmission admission
    ) {
        return search(areaCode, null, size, null, null, CONTENT_TYPE_RESTAURANT, lat, lng, admission);
    }

    private List<PlaceCandidateQueryResult> search(
        String areaCode, String sigunguCode, int size, Boolean indoor, String sourceCategory, String contentType, PetAdmission admission
    ) {
        return search(areaCode, sigunguCode, size, indoor, sourceCategory, contentType, null, null, admission);
    }

    /**
     * {@code lat} · {@code lng} 를 함께 주면 그 점에서 가까운 순, 둘 다 null 이면 {@code placeId} 순이다 (#1312).
     *
     * <p>동행견 입장 기준({@code admission})은 tour-service 검색 필터({@code petSizeType} · {@code petWeightKg})로 넘긴다 (#1420) —
     * 두 정렬 모두 같은 필터를 거친다. 입장할 수 없는 장소가 한 페이지(50곳)의 자리를 차지하지 않게 검색 단계에서 거른다.
     */
    private List<PlaceCandidateQueryResult> search(
        String areaCode, String sigunguCode, int size, Boolean indoor, String sourceCategory, String contentType,
        Double lat, Double lng, PetAdmission admission
    ) {
        PetAdmission safeAdmission = admission == null ? PetAdmission.ANY : admission;
        String petSizeType = petSizeTypeParam(safeAdmission.sizeType());
        Integer petWeightKg = petWeightKgParam(safeAdmission.weightKg());
        PlaceSliceClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> placeCandidateClient.searchPlaces(
                areaCode, sigunguCode, PET_ALLOWED, size, indoor, sourceCategory, contentType, lat, lng, petSizeType, petWeightKg));

        if (body == null || body.contents() == null) {
            log.warn("Place candidates empty areaCode={} sigunguCode={} contentType={} lat={} lng={} size={} petSizeType={} petWeightKg={}",
                areaCode, sigunguCode, contentType, lat, lng, size, petSizeType, petWeightKg);
            return List.of();
        }
        return body.contents().stream()
            // 식별자나 좌표가 없으면 일정에 넣어도 저장하거나 지도에 그릴 수 없다.
            // 후보 단계에서 빼는 편이 낫다 - LLM 에게 못 쓰는 선택지를 주지 않는다.
            .filter(item -> item.placeId() != null && !item.placeId().isBlank())
            .filter(item -> item.lat() != null && item.lng() != null)
            .map(this::toQueryResult)
            .toList();
    }

    /** tour-service 검색의 {@code petSizeType} — enum 이름. null 이면 크기 조건을 걸지 않는다 (#1420). */
    private static String petSizeTypeParam(PetSizeType sizeType) {
        return sizeType == null ? null : sizeType.name();
    }

    /**
     * tour-service 검색의 {@code petWeightKg} — 가장 무거운 유효 체중의 <b>올림</b>을 1~100 으로 자른 값 (#1420). null 이면 체중
     * 조건을 걸지 않는다.
     *
     * <p><b>올림이 정확하다.</b> 장소 상한({@code maxPetWeightKg})이 정수라 {@code w <= max} 와 {@code ceil(w) <= max} 가 같다.
     * 3.2kg 을 내림(3)하면 상한 3kg 인 곳이 통과하고, 반올림해도 3.4kg 이 같은 식으로 샌다.
     *
     * <p><b>1~100 으로 자르는 것은 tour-service 입력 검증({@code @Min(1) @Max(100)}) 때문이다</b> — 넘으면 400 이 난다. 100 을 넘는
     * 체중은 100 으로 보내므로 상한 100kg 이상인 곳이 검색을 통과할 수 있지만, 워커의 메모리 판정({@link PetAdmission#admits})이
     * 실제 유효 체중으로 다시 거른다.
     */
    private static Integer petWeightKgParam(BigDecimal weightKg) {
        if (weightKg == null) {
            return null;
        }
        BigDecimal ceiled = weightKg.setScale(0, RoundingMode.CEILING);
        if (ceiled.compareTo(BigDecimal.valueOf(SEARCH_WEIGHT_MIN_KG)) < 0) {
            return SEARCH_WEIGHT_MIN_KG;
        }
        if (ceiled.compareTo(BigDecimal.valueOf(SEARCH_WEIGHT_MAX_KG)) > 0) {
            return SEARCH_WEIGHT_MAX_KG;
        }
        return ceiled.intValueExact();
    }

    @Override
    public List<PlaceCandidateQueryResult> findCandidatesByIds(List<Long> placeIds) {
        if (placeIds == null || placeIds.isEmpty()) {
            return List.of();
        }
        List<PlaceCandidateInternalClientResponse> body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> pinnedPlaceCandidateClient.getCandidates(placeIds));
        if (body == null) {
            return List.of();
        }
        return body.stream()
            .filter(item -> item.placeId() != null)
            .filter(item -> item.lat() != null && item.lng() != null)
            .map(this::toQueryResult)
            .toList();
    }

    private PlaceCandidateQueryResult toQueryResult(PlaceCandidateInternalClientResponse item) {
        return PlaceCandidateQueryResult.builder()
            .placeId(item.placeId())
            .title(item.title())
            .contentTypeName(item.contentTypeName())
            .addr(item.addr())
            .petAllowanceName(item.petAllowanceName())
            .allowedPetSize(allowedPetSizeByDisplayName(item.allowedPetSizeName(), item.placeId()))
            .maxPetWeightKg(item.maxPetWeightKg())
            .indoor(item.indoor())
            .sourceCategory(item.sourceCategory())
            .lat(item.lat())
            .lng(item.lng())
            .build();
    }

    private PlaceCandidateQueryResult toQueryResult(PlaceItemClientResponse item) {
        return PlaceCandidateQueryResult.builder()
            .placeId(Long.parseLong(item.placeId()))
            .title(item.title())
            .contentTypeName(nameOf(item.contentType()))
            .addr(item.addr1())
            .petAllowanceName(nameOf(item.petAllowanceType()))
            .allowedPetSize(allowedPetSizeByCode(item.allowedPetSize(), item.placeId()))
            .maxPetWeightKg(item.maxPetWeightKg())
            .indoor(item.indoor())
            .sourceCategory(item.sourceCategory())
            .lat(item.lat())
            .lng(item.lng())
            .build();
    }

    private String nameOf(MetadataClientResponse metadata) {
        return metadata == null ? null : metadata.name();
    }

    /**
     * 검색 응답의 입장 크기 metadata 를 enum 으로 (#1420). {@code code} 가 {@link AllowedPetSize} 이름이다.
     *
     * <p>모르는 코드면 null 로 두고 경고한다 — null 은 "제한 정보 없음" 이라 막지 않는다. tour-service 가 값을 늘렸는데
     * 이쪽이 모르는 것이므로, 조용히 넘기면 그 장소의 제한이 계속 빠진다.
     */
    private static AllowedPetSize allowedPetSizeByCode(MetadataClientResponse metadata, String placeId) {
        if (metadata == null || metadata.code() == null || metadata.code().isBlank()) {
            return null;
        }
        try {
            return AllowedPetSize.valueOf(metadata.code());
        } catch (IllegalArgumentException exception) {
            log.warn("Unknown allowed pet size code from tour-service code={} placeId={}", metadata.code(), placeId);
            return null;
        }
    }

    /**
     * 내부 후보 응답의 입장 크기 표시명을 enum 으로 되돌린다 (#1420). 이 경로는 표시명({@code getDisplayName()})만 온다 —
     * 응답 계약을 바꾸지 않으려고 이쪽에서 역매핑한다.
     *
     * <p>비었으면 null, 모르는 표시명이면 null 로 두고 경고한다 ({@link #allowedPetSizeByCode} 와 같은 이유).
     */
    private static AllowedPetSize allowedPetSizeByDisplayName(String displayName, Long placeId) {
        if (displayName == null || displayName.isBlank()) {
            return null;
        }
        String trimmed = displayName.strip();
        for (AllowedPetSize size : AllowedPetSize.values()) {
            if (size.getDisplayName().equals(trimmed)) {
                return size;
            }
        }
        log.warn("Unknown allowed pet size name from tour-service name={} placeId={}", displayName, placeId);
        return null;
    }
}
