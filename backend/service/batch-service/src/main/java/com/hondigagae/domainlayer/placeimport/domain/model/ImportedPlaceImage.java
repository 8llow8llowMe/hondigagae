package com.hondigagae.domainlayer.placeimport.domain.model;

import lombok.Builder;

/**
 * TourAPI detailImage2 로 수집한 장소 추가 이미지 한 장.
 * serialNum 은 원천 일련번호로, 재실행 시 같은 이미지가 같은 행이 되게 하는 기준이다.
 */
@Builder
public record ImportedPlaceImage(
    String originImgUrl,
    String smallImageUrl,
    String imgName,
    String serialNum,
    String cpyrhtDivCd
) {

}
