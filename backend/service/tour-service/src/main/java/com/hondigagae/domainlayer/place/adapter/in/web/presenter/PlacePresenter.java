package com.hondigagae.domainlayer.place.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceImageItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceIntroItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlacePetInfoItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceDetailResponse;
import com.hondigagae.domainlayer.place.application.info.PlaceDetailInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceImageInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceIntroInfo;
import com.hondigagae.domainlayer.place.application.info.PlacePetDetailInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
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

    public PlaceDetailResponse toDetailResponse(PlaceDetailInfo detailInfo) {
        Place place = detailInfo.place();
        return PlaceDetailResponse.builder()
            .placeId(String.valueOf(place.id()))
            .contentId(String.valueOf(place.contentId()))
            .contentType(toContentTypeMetadata(ContentType.fromCode(place.contentTypeId())))
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
            .petAllowanceType(toPetAllowanceMetadata(place.petAllowanceType()))
            .intro(toIntroItem(detailInfo.intro()))
            .petInfo(toPetInfoItem(detailInfo.petInfo()))
            .images(toImageItems(detailInfo.images()))
            .build();
    }

    private PlaceItem toItem(PlaceSummaryInfo info) {
        return PlaceItem.builder()
            .placeId(String.valueOf(info.placeId()))
            .contentType(toContentTypeMetadata(info.contentType()))
            .title(info.title())
            .addr1(info.addr1())
            .sigunguCode(info.sigunguCode())
            .lat(toDouble(info.lat()))
            .lng(toDouble(info.lng()))
            .firstImage(info.firstImage())
            .firstImage2(info.firstImage2())
            .petAllowanceType(toPetAllowanceMetadata(info.petAllowanceType()))
            .tel(info.tel())
            .build();
    }

    private PlaceIntroItem toIntroItem(PlaceIntroInfo intro) {
        if (intro == null) {
            return null;
        }
        return PlaceIntroItem.builder()
            .infoCenter(intro.infoCenter())
            .useTime(intro.useTime())
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
            .allowanceScope(CodeNameDescriptionMetadata.of(
                petInfo.allowanceScope().name(), petInfo.allowanceScope().getDisplayName(), petInfo.allowanceScope().getDescription()))
            .allowedPetSize(CodeNameDescriptionMetadata.of(
                petInfo.allowedPetSize().name(), petInfo.allowedPetSize().getDisplayName(), petInfo.allowedPetSize().getDescription()))
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

    private CodeNameDescriptionMetadata toContentTypeMetadata(ContentType contentType) {
        return CodeNameDescriptionMetadata.of(contentType.name(), contentType.getDisplayName(), contentType.getDescription());
    }

    private CodeNameDescriptionMetadata toPetAllowanceMetadata(PetAllowanceType petAllowanceType) {
        return CodeNameDescriptionMetadata.of(petAllowanceType.name(), petAllowanceType.getDisplayName(), petAllowanceType.getDescription());
    }

    private Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }
}
