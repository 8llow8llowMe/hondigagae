package com.hondigagae.domainlayer.favorite.application.port.out;

import com.hondigagae.domainlayer.favorite.application.port.out.query.FavoritePlaceQueryResult;
import java.util.List;

/**
 * 장소 요약 조회 계약.
 *
 * <p>두 용도로 쓰인다: 저장 시 <b>존재 검증</b>(요청 아이디가 결과에 없으면 노출 불가 장소),
 * 목록 시 <b>카드 정보 장식</b>. 전송 실패는 {@code FavoriteException}(FAVORITE_900)으로
 * 올라온다 — 저장 경로는 그대로 실패시키고, 목록 경로는 호출부가 잡아서 장식 없이 내려간다.
 */
public interface FavoritePlaceLookupPort {

    List<FavoritePlaceQueryResult> findSummaries(List<Long> placeIds);
}
