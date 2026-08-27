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

    public PlaceDetailInfo getPlaceDetail(long placeId) {
        Place place = placeRepositoryPort.findPlaceById(placeId)
            .orElseThrow(() -> new PlaceException(PlaceErrorCode.NOT_FOUND_PLACE));

        PlaceIntroInfo intro = placeRepositoryPort.findIntroByPlaceId(placeId)
            .map(result -> PlaceIntroInfo.builder()
                .infoCenter(result.infoCenter())
                .useTime(result.useTime())
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
