package com.hondigagae.domainlayer.favorite.application.port.in;

import java.util.List;

/**
 * 서비스 간 호출 전용 유스케이스 (coding-conventions §5).
 * ai-service 가 "즐겨찾기 우선 반영" 옵션에서 찜한 장소 아이디를 가져간다.
 */
public interface FavoriteInternalUseCase {

    List<Long> getFavoritePlaceIds(long memberId);
}
