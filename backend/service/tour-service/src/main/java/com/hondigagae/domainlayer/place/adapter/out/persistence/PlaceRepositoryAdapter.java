package com.hondigagae.domainlayer.place.adapter.out.persistence;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceImageEntity;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceIntroEntity;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlacePetInfoEntity;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.adapter.out.persistence.repository.PlaceImageRepository;
import com.hondigagae.domainlayer.place.adapter.out.persistence.repository.PlaceIntroRepository;
import com.hondigagae.domainlayer.place.adapter.out.persistence.repository.PlacePetInfoRepository;
import com.hondigagae.domainlayer.place.adapter.out.persistence.repository.PlaceRepository;
import com.hondigagae.domainlayer.place.application.mapper.PlaceMapper;
import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.model.Place;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlaceRepositoryAdapter implements PlaceRepositoryPort {

    private final PlaceRepository placeRepository;
    private final PlaceIntroRepository placeIntroRepository;
    private final PlacePetInfoRepository placePetInfoRepository;
    private final PlaceImageRepository placeImageRepository;
    private final PlaceMapper placeMapper;

    @Override
    public PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria) {
        Slice<PlaceEntity> slice = placeRepository.findAllByCriteria(
            criteria.areaCode(), criteria.sigunguCode(),
            criteria.contentType() == null ? null : criteria.contentType().getCode(),
            criteria.petAllowanceType(), criteria.indoor(), criteria.allowedPetSize(),
            // 받아 주는 값의 집합으로 바꿔 in 절에 넣는다. petSizeType 이 null 이면 전체 집합이라 필터가 꺼진다.
            AllowedPetSize.allowing(criteria.petSizeType()), criteria.petWeightKg(),
            criteria.sourceCategory(), criteria.lastPlaceId(),
            PageRequest.of(0, criteria.size())
        );
        return new PlaceSliceQueryResult(placeMapper.toDomains(slice.getContent()), slice.hasNext());
    }

    @Override
    public Optional<Place> findPlaceById(long placeId) {
        return placeRepository.findByIdAndMergedIntoIdIsNull(placeId).map(placeMapper::toDomain);
    }

    @Override
    public Optional<PlaceIntroQueryResult> findIntroByPlaceId(long placeId) {
        return placeIntroRepository.findByPlaceId(placeId).map(this::toIntroQueryResult);
    }

    @Override
    public Optional<PlacePetInfoQueryResult> findPetInfoByPlaceId(long placeId) {
        return placePetInfoRepository.findByPlaceId(placeId).map(this::toPetInfoQueryResult);
    }

    @Override
    public List<PlaceImageQueryResult> findImagesByPlaceId(long placeId) {
        return placeImageRepository.findAllByPlaceIdOrderBySerialNumAsc(placeId).stream()
            .map(this::toImageQueryResult)
            .toList();
    }

    @Override
    public List<Place> findNearby(NearbyPlaceCriteria criteria) {
        double latDelta = GeoDistance.latDelta(criteria.radius());
        double lngDelta = GeoDistance.lngDelta(criteria.radius(), criteria.lat());

        return placeRepository.findNearby(
                BigDecimal.valueOf(criteria.lat() - latDelta),
                BigDecimal.valueOf(criteria.lat() + latDelta),
                BigDecimal.valueOf(criteria.lng() - lngDelta),
                BigDecimal.valueOf(criteria.lng() + lngDelta),
                criteria.contentType() == null ? null : criteria.contentType().getCode(),
                criteria.petAllowanceType(),
                criteria.indoor(),
                criteria.allowedPetSize(),
                AllowedPetSize.allowing(criteria.petSizeType()),
                criteria.petWeightKg(),
                criteria.sourceCategory()
            ).stream()
            .map(placeMapper::toDomain)
            .toList();
    }

    private PlaceIntroQueryResult toIntroQueryResult(PlaceIntroEntity entity) {
        return PlaceIntroQueryResult.builder()
            .infoCenter(entity.getInfoCenter())
            .useTime(entity.getUseTime())
            .restDate(entity.getRestDate())
            .parking(entity.getParking())
            .chkPet(entity.getChkPet())
            .chkBabyCarriage(entity.getChkBabyCarriage())
            .chkCreditCard(entity.getChkCreditCard())
            .build();
    }

    private PlacePetInfoQueryResult toPetInfoQueryResult(PlacePetInfoEntity entity) {
        return PlacePetInfoQueryResult.builder()
            .acmpyTypeCd(entity.getAcmpyTypeCd())
            .acmpyPsblCpam(entity.getAcmpyPsblCpam())
            .acmpyNeedMtr(entity.getAcmpyNeedMtr())
            .etcAcmpyInfo(entity.getEtcAcmpyInfo())
            .relaAcdntRiskMtr(entity.getRelaAcdntRiskMtr())
            .relaFrnshPrdlst(entity.getRelaFrnshPrdlst())
            .relaPosesFclty(entity.getRelaPosesFclty())
            .relaPurcPrdlst(entity.getRelaPurcPrdlst())
            .relaRntlPrdlst(entity.getRelaRntlPrdlst())
            .allowanceScope(entity.getAllowanceScope())
            .allowedPetSize(entity.getAllowedPetSize())
            .leashRequired(entity.isLeashRequired())
            .build();
    }

    private PlaceImageQueryResult toImageQueryResult(PlaceImageEntity entity) {
        return PlaceImageQueryResult.builder()
            .originImgUrl(entity.getOriginImgUrl())
            .smallImageUrl(entity.getSmallImageUrl())
            .imgName(entity.getImgName())
            .cpyrhtDivCd(entity.getCpyrhtDivCd())
            .build();
    }
}
