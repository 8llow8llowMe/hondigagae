package com.hondigagae.domainlayer.place.application.port.out.query;

import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDateTime;

/**
 * 사이트맵 한 줄에 필요한 장소 3컬럼.
 *
 * <p>전량을 읽는 조회라 엔티티 전체(개요 TEXT 등)를 끌어오지 않도록 이 셋만 projection 으로 가져온다.
 *
 * @param sourceModifiedAt 원천 수정일(modifiedtime). 원천에 수정일이 없으면 null
 */
public record PlaceSitemapEntryQueryResult(long placeId, PetAllowanceType petAllowanceType, LocalDateTime sourceModifiedAt) {

}
