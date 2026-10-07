package com.hondigagae.domainlayer.place.application.info;

import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 사이트맵 한 줄.
 *
 * @param modifiedAt 원천 수정일. 적재 시각이 아니다 — 원천에 수정일이 없으면 null
 */
@Builder
public record PlaceSitemapEntryInfo(long placeId, PetAllowanceType petAllowanceType, LocalDateTime modifiedAt) {

}
