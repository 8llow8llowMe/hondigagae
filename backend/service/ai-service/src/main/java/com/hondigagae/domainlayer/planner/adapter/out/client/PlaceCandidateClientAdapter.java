package com.hondigagae.domainlayer.planner.adapter.out.client;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PinnedPlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceCandidateInternalClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.MetadataClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.PlaceItemClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.port.out.PlaceCandidateQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import com.hondigagae.shared.travel.place.PetAllowanceType;
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

    private final PlaceCandidateClient placeCandidateClient;
    private final PinnedPlaceCandidateClient pinnedPlaceCandidateClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<PlaceCandidateQueryResult> findPetFriendlyCandidates(String areaCode, String sigunguCode, int size) {
        return search(areaCode, sigunguCode, size, null, null, null);
    }

    @Override
    public List<PlaceCandidateQueryResult> findRequestedCandidates(
        String areaCode, String sigunguCode, int size, Boolean indoor, String sourceCategory
    ) {
        return search(areaCode, sigunguCode, size, indoor, sourceCategory, null);
    }

    @Override
    public List<PlaceCandidateQueryResult> findLodgingCandidates(String areaCode, String sigunguCode, int size) {
        return search(areaCode, sigunguCode, size, null, null, CONTENT_TYPE_LODGING);
    }

    @Override
    public List<PlaceCandidateQueryResult> findRestaurantCandidates(String areaCode, String sigunguCode, int size) {
        return search(areaCode, sigunguCode, size, null, null, CONTENT_TYPE_RESTAURANT);
    }

    @Override
    public List<PlaceCandidateQueryResult> findNearbyCandidates(String areaCode, double lat, double lng, int size) {
        return search(areaCode, null, size, null, null, null, lat, lng);
    }

    @Override
    public List<PlaceCandidateQueryResult> findNearbyLodgingCandidates(String areaCode, double lat, double lng, int size) {
        return search(areaCode, null, size, null, null, CONTENT_TYPE_LODGING, lat, lng);
    }

    @Override
    public List<PlaceCandidateQueryResult> findNearbyRestaurantCandidates(String areaCode, double lat, double lng, int size) {
        return search(areaCode, null, size, null, null, CONTENT_TYPE_RESTAURANT, lat, lng);
    }

    private List<PlaceCandidateQueryResult> search(
        String areaCode, String sigunguCode, int size, Boolean indoor, String sourceCategory, String contentType
    ) {
        return search(areaCode, sigunguCode, size, indoor, sourceCategory, contentType, null, null);
    }

    /** {@code lat} · {@code lng} 를 함께 주면 그 점에서 가까운 순, 둘 다 null 이면 {@code placeId} 순이다 (#1312). */
    private List<PlaceCandidateQueryResult> search(
        String areaCode, String sigunguCode, int size, Boolean indoor, String sourceCategory, String contentType,
        Double lat, Double lng
    ) {
        PlaceSliceClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> placeCandidateClient.searchPlaces(
                areaCode, sigunguCode, PET_ALLOWED, size, indoor, sourceCategory, contentType, lat, lng));

        if (body == null || body.contents() == null) {
            log.warn("Place candidates empty areaCode={} sigunguCode={} contentType={} lat={} lng={} size={}",
                areaCode, sigunguCode, contentType, lat, lng, size);
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
            .allowedPetSizeName(item.allowedPetSizeName())
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
            .allowedPetSizeName(nameOf(item.allowedPetSize()))
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
}
