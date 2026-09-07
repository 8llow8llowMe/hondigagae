package com.hondigagae.domainlayer.place.adapter.in.web.presenter;

import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.NearbyPlaceItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceImageItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceIntroItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlacePetInfoItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.NearbyPlaceResponse;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceDetailResponse;
import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceDetailInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceImageInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceIntroInfo;
import com.hondigagae.domainlayer.place.application.info.PlacePetDetailInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.persistence.dto.SliceResponse;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PlacePresenter {

    public SliceResponse<PlaceItem> toSliceResponse(PlaceSummariesInfo summariesInfo) {
        List<PlaceItem> items = summariesInfo.places().stream()
            .map(this::toItem)
            .toList();
        return new SliceResponse<>(items, summariesInfo.hasNext());
    }

    /**
     * 주변 장소 응답.
     *
     * <p><b>{@code totalCount} 를 {@code items.size()} 로 채우지 않는다</b>(이슈 #285).
     * 목록은 {@code size} 로 잘려 있어 여기서 다시 세면 두 값이 언제나 같아지고, 그러면
     * 이름만 총계인 값이 나간다.
     */
    public NearbyPlaceResponse toNearbyResponse(NearbyPlacesInfo info, NearbyPlaceCriteria criteria) {
        List<NearbyPlaceItem> items = info.places().stream()
            .map(nearby -> NearbyPlaceItem.builder()
                .place(toItem(nearby.place()))
                .distanceMeters(nearby.distanceMeters())
                .build())
            .toList();

        return NearbyPlaceResponse.builder()
            .places(items)
            .totalCount(info.totalCount())
            .radius(criteria.radius())
            .build();
    }

    public PlaceDetailResponse toDetailResponse(PlaceDetailInfo detailInfo) {
        Place place = detailInfo.place();
        return PlaceDetailResponse.builder()
            .placeId(String.valueOf(place.id()))
            .contentId(toStringOrNull(place.contentId()))
            .contentType(ContentType.fromCode(place.contentTypeId()).toMetadata())
            .title(place.title())
            .addr1(place.addr1())
            .addr2(place.addr2())
            .zipcode(place.zipcode())
            .lat(toDouble(place.lat()))
            .lng(toDouble(place.lng()))
            .firstImage(place.firstImage())
            .firstImage2(place.firstImage2())
            .cpyrhtDivCd(place.cpyrhtDivCd())
            .tel(place.tel())
            .homepage(place.homepage())
            .overview(place.overview())
            .petAvailable(place.petAvailable())
            .delisted(place.delistedAt() != null)
            .petAllowanceType(place.petAllowanceType().toMetadata())
            .indoor(place.indoor())
            .sourceCategory(place.sourceCategory())
            .sourceName(place.source() == null ? null : place.source().getDisplayName())
            .intro(toIntroItem(detailInfo.intro()))
            .petInfo(toPetInfoItem(detailInfo.petInfo()))
            .images(toImageItems(detailInfo.images()))
            .build();
    }

    private PlaceItem toItem(PlaceSummaryInfo info) {
        return PlaceItem.builder()
            .placeId(String.valueOf(info.placeId()))
            .contentType(info.contentType().toMetadata())
            .title(info.title())
            .addr1(info.addr1())
            .sigunguCode(info.sigunguCode())
            .lat(toDouble(info.lat()))
            .lng(toDouble(info.lng()))
            .firstImage(info.firstImage())
            .firstImage2(info.firstImage2())
            .petAllowanceType(info.petAllowanceType().toMetadata())
            .allowedPetSize(info.allowedPetSize() == null ? null : info.allowedPetSize().toMetadata())
            .maxPetWeightKg(info.maxPetWeightKg())
            .tel(info.tel())
            .indoor(info.indoor())
            .sourceCategory(info.sourceCategory())
            .sourceName(info.source() == null ? null : info.source().getDisplayName())
            .build();
    }

    private PlaceIntroItem toIntroItem(PlaceIntroInfo intro) {
        if (intro == null) {
            return null;
        }
        return PlaceIntroItem.builder()
            .infoCenter(intro.infoCenter())
            .useTime(intro.useTime())
            .openNow(intro.openNow())
            .open24(intro.open24())
            .restDate(intro.restDate())
            .parking(intro.parking())
            .chkPet(intro.chkPet())
            .chkBabyCarriage(intro.chkBabyCarriage())
            .chkCreditCard(intro.chkCreditCard())
            .build();
    }

    private PlacePetInfoItem toPetInfoItem(PlacePetDetailInfo petInfo) {
        if (petInfo == null) {
            return null;
        }
        return PlacePetInfoItem.builder()
            .acmpyTypeCd(petInfo.acmpyTypeCd())
            .acmpyPsblCpam(petInfo.acmpyPsblCpam())
            .acmpyNeedMtr(petInfo.acmpyNeedMtr())
            .etcAcmpyInfo(petInfo.etcAcmpyInfo())
            .relaAcdntRiskMtr(petInfo.relaAcdntRiskMtr())
            .relaFrnshPrdlst(petInfo.relaFrnshPrdlst())
            .relaPosesFclty(petInfo.relaPosesFclty())
            .relaPurcPrdlst(petInfo.relaPurcPrdlst())
            .relaRntlPrdlst(petInfo.relaRntlPrdlst())
            .allowanceScope(petInfo.allowanceScope().toMetadata())
            .allowedPetSize(petInfo.allowedPetSize().toMetadata())
            .leashRequired(petInfo.leashRequired())
            .build();
    }

    private List<PlaceImageItem> toImageItems(List<PlaceImageInfo> images) {
        return images.stream()
            .map(image -> PlaceImageItem.builder()
                .originImgUrl(image.originImgUrl())
                .smallImageUrl(image.smallImageUrl())
                .imgName(image.imgName())
                .cpyrhtDivCd(image.cpyrhtDivCd())
                .build())
            .toList();
    }

    private Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    /**
     * 아이디를 문자열로 내린다. Snowflake·TourAPI 아이디가 자바스크립트 Number 의 안전 정수 범위를
     * 넘기 때문이다.
     *
     * <p><b>{@code String.valueOf} 를 직접 쓰지 않는다.</b> 인자가 null 이면 문자열 {@code "null"}
     * 을 돌려주는데, 그것은 길이 4의 유효한 문자열이라 클라이언트의 null 검사를 통과해 화면과 링크
     * 파라미터로 새어 나간다. {@code contentId} 는 원천이 TourAPI 가 아니면 실제로 null 이다.
     */
    private String toStringOrNull(Long value) {
        return value == null ? null : String.valueOf(value);
    }
}
