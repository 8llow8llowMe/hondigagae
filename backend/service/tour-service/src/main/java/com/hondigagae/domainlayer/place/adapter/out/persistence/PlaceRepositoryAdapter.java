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
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.model.Place;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
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
        Slice<PlaceEntity> slice = placeRepository.searchByCriteria(criteria);
        return new PlaceSliceQueryResult(placeMapper.toDomains(slice.getContent()), slice.hasNext());
    }

    @Override
    public List<Long> findVisibleIds(Collection<Long> placeIds) {
        if (placeIds.isEmpty()) {
            return List.of();
        }
        return placeRepository.findVisibleIds(placeIds);
    }

    @Override
    public List<Place> findVisiblePlaces(Collection<Long> placeIds) {
        if (placeIds.isEmpty()) {
            return List.of();
        }
        return placeMapper.toDomains(placeRepository.findVisiblePlaces(placeIds));
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

    /**
     * 원천(TourAPI) serialnum 은 자릿수가 다른 숫자 문자열이고, 원천에 일련번호가 없으면 적재가
     * URL 해시(16진)로 대체한다. 컬럼 사전순은 "10" 을 "2" 앞에 두므로 여기서 숫자 값을 우선
     * (짧은 것 먼저 → 사전순 = 숫자 크기순) 세우고, 순서 의미가 없는 해시는 그 뒤에 사전순으로
     * 고정만 한다 — 어느 쪽이든 호출마다 같은 순서를 준다.
     */
    static final Comparator<PlaceImageEntity> GALLERY_ORDER =
        Comparator.comparing((PlaceImageEntity image) -> !isDigits(image.getSerialNum()))
            .thenComparingInt(image -> image.getSerialNum().length())
            .thenComparing(PlaceImageEntity::getSerialNum);

    @Override
    public List<PlaceImageQueryResult> findImagesByPlaceId(long placeId) {
        return placeImageRepository.findAllByPlaceId(placeId).stream()
            .sorted(GALLERY_ORDER)
            .map(this::toImageQueryResult)
            .toList();
    }

    private static boolean isDigits(String value) {
        return !value.isEmpty() && value.chars().allMatch(Character::isDigit);
    }

    @Override
    public List<Place> findNearby(NearbyPlaceCriteria criteria) {
        return placeRepository.searchNearby(criteria).stream()
            .map(placeMapper::toDomain)
            .toList();
    }

    private PlaceIntroQueryResult toIntroQueryResult(PlaceIntroEntity entity) {
        return PlaceIntroQueryResult.builder()
            .infoCenter(entity.getInfoCenter())
            .useTime(entity.getUseTime())
            .weeklyHoursSpec(entity.getWeeklyHoursSpec())
            .open24(entity.isOpen24())
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
