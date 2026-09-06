package com.hondigagae.domainlayer.place.application.service.processor;

import com.hondigagae.domainlayer.place.application.exception.PlaceErrorCode;
import com.hondigagae.domainlayer.place.application.exception.PlaceException;
import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.place.application.info.NearbyPlaceInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceDetailInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceImageInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceIntroInfo;
import com.hondigagae.domainlayer.place.application.info.PlacePetDetailInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.domainlayer.place.domain.model.PlaceOpenState;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlaceQueryProcessor {

    private final PlaceRepositoryPort placeRepositoryPort;

    public PlaceSummariesInfo getPlaces(PlaceSearchCriteria criteria) {
        PlaceSliceQueryResult queryResult = placeRepositoryPort.findPlaces(criteria);
        List<PlaceSummaryInfo> summaries = queryResult.places().stream()
            .map(this::toSummaryInfo)
            .toList();
        return new PlaceSummariesInfo(summaries, queryResult.hasNext());
    }

    /**
     * 사각 범위 결과를 정확한 반경으로 다듬고 가까운 순으로 자른다.
     *
     * <p>제주 장소가 수백 곳 규모라 메모리 정렬 비용이 문제 되지 않는다. 전국으로 넓히면
     * 공간 인덱스로 옮겨야 하는 지점이 여기다.
     */
    public List<NearbyPlaceInfo> getNearbyPlaces(NearbyPlaceCriteria criteria) {
        return placeRepositoryPort.findNearby(criteria).stream()
            .map(place -> toNearbyInfo(place, criteria))
            .filter(info -> info.distanceMeters() <= criteria.radius())
            .sorted(Comparator.comparingInt(NearbyPlaceInfo::distanceMeters))
            .limit(criteria.size())
            .toList();
    }

    private NearbyPlaceInfo toNearbyInfo(Place place, NearbyPlaceCriteria criteria) {
        double distance = GeoDistance.meters(
            criteria.lat(), criteria.lng(), place.lat().doubleValue(), place.lng().doubleValue());
        return NearbyPlaceInfo.builder()
            .place(toSummaryInfo(place))
            .distanceMeters((int) Math.round(distance))
            .build();
    }

    public List<Long> findVisibleIds(List<Long> placeIds) {
        return placeRepositoryPort.findVisibleIds(placeIds);
    }

    /**
     * 아이디로 장소 요약을 준다. 노출 불가(병합·delisted) 장소는 조용히 빠진다 —
     * 호출한 쪽이 요청 아이디와 대조해 누락을 판단한다.
     */
    public List<PlaceSummaryInfo> getVisiblePlaceSummaries(List<Long> placeIds) {
        return placeRepositoryPort.findVisiblePlaces(placeIds).stream()
            .map(this::toSummaryInfo)
            .toList();
    }

    public PlaceDetailInfo getPlaceDetail(long placeId) {
        Place place = placeRepositoryPort.findPlaceById(placeId)
            .orElseThrow(() -> new PlaceException(PlaceErrorCode.NOT_FOUND_PLACE));

        PlaceIntroInfo intro = placeRepositoryPort.findIntroByPlaceId(placeId)
            .map(result -> PlaceIntroInfo.builder()
                .infoCenter(result.infoCenter())
                .useTime(result.useTime())
                .openNow(PlaceOpenState.resolve(result.weeklyHoursSpec(), result.open24(), LocalDateTime.now()))
                .open24(result.open24())
                .restDate(result.restDate())
                .parking(result.parking())
                .chkPet(result.chkPet())
                .chkBabyCarriage(result.chkBabyCarriage())
                .chkCreditCard(result.chkCreditCard())
                .build())
            .orElse(null);

        PlacePetDetailInfo petInfo = placeRepositoryPort.findPetInfoByPlaceId(placeId)
            .map(result -> PlacePetDetailInfo.builder()
                .acmpyTypeCd(result.acmpyTypeCd())
                .acmpyPsblCpam(result.acmpyPsblCpam())
                .acmpyNeedMtr(result.acmpyNeedMtr())
                .etcAcmpyInfo(result.etcAcmpyInfo())
                .relaAcdntRiskMtr(result.relaAcdntRiskMtr())
                .relaFrnshPrdlst(result.relaFrnshPrdlst())
                .relaPosesFclty(result.relaPosesFclty())
                .relaPurcPrdlst(result.relaPurcPrdlst())
                .relaRntlPrdlst(result.relaRntlPrdlst())
                .allowanceScope(result.allowanceScope())
                .allowedPetSize(result.allowedPetSize())
                .leashRequired(result.leashRequired())
                .build())
            .orElse(null);

        List<PlaceImageInfo> images = placeRepositoryPort.findImagesByPlaceId(placeId).stream()
            .map(result -> PlaceImageInfo.builder()
                .originImgUrl(result.originImgUrl())
                .smallImageUrl(result.smallImageUrl())
                .imgName(result.imgName())
                .cpyrhtDivCd(result.cpyrhtDivCd())
                .build())
            .toList();

        /*
          place_image 는 TourAPI 추가 이미지 배치가 채우는 테이블이라 비어 있을 수 있고,
          문화정보원·식약처 원천 장소는 추가 이미지 API 자체가 없다. 대표 이미지가 있으면
          한 장짜리 갤러리로 폴백한다 — 프론트가 firstImage 를 따로 조립하지 않아도
          상세 갤러리가 성립하고, 배치가 채우면 자연히 원본 목록으로 대체된다.
        */
        if (images.isEmpty() && place.firstImage() != null && !place.firstImage().isBlank()) {
            images = List.of(PlaceImageInfo.builder()
                .originImgUrl(place.firstImage())
                .smallImageUrl(place.firstImage2())
                .imgName(place.title())
                .cpyrhtDivCd(place.cpyrhtDivCd())
                .build());
        }

        return PlaceDetailInfo.builder()
            .place(place)
            .intro(intro)
            .petInfo(petInfo)
            .images(images)
            .build();
    }

    private PlaceSummaryInfo toSummaryInfo(Place place) {
        return PlaceSummaryInfo.builder()
            .placeId(place.id())
            .contentType(ContentType.fromCode(place.contentTypeId()))
            .title(place.title())
            .addr1(place.addr1())
            .sigunguCode(place.sigunguCode())
            .lat(place.lat())
            .lng(place.lng())
            .firstImage(place.firstImage())
            .firstImage2(place.firstImage2())
            .petAllowanceType(place.petAllowanceType())
            .allowedPetSize(place.allowedPetSize())
            .maxPetWeightKg(place.maxPetWeightKg())
            .tel(place.tel())
            .indoor(place.indoor())
            .sourceCategory(place.sourceCategory())
            .source(place.source())
            .build();
    }
}
