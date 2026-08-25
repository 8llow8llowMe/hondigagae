package com.hondigagae.domainlayer.place.application.info;

import com.hondigagae.domainlayer.place.domain.model.Place;
import java.util.List;
import lombok.Builder;

@Builder
public record PlaceDetailInfo(
    Place place,
    PlaceIntroInfo intro,
    PlacePetDetailInfo petInfo,
    List<PlaceImageInfo> images
) {

}
