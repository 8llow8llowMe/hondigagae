package com.hondigagae.domainlayer.place.application.info;

import com.hondigagae.domainlayer.place.domain.model.Place;
import java.util.List;
import lombok.Builder;

/**
 * 장소 상세.
 *
 * @param petRestriction 반려동물 제한사항을 {@code PetRestriction} 규칙으로 읽은 값 (#1523). "제한 없음" 자리표시와 빈 값은 null 이다.
 *                       {@code place().petRestriction()} 은 원천 원문 그대로라 응답에 쓰지 않는다
 */
@Builder
public record PlaceDetailInfo(
    Place place,
    String petRestriction,
    PlaceIntroInfo intro,
    PlacePetDetailInfo petInfo,
    List<PlaceImageInfo> images
) {

}
