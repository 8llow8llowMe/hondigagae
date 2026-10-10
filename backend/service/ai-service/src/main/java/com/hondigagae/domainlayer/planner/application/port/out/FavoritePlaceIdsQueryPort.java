package com.hondigagae.domainlayer.planner.application.port.out;

import java.util.List;

/**
 * 즐겨찾기 장소 아이디 조회 계약.
 *
 * <p>즐겨찾기는 <b>선호</b>이지 필수가 아니다 — 조회에 실패해도 일정 생성은 계속되고
 * 선호 표시만 빠진다. 반려견 특성과 같은 관용 원칙이다.
 */
public interface FavoritePlaceIdsQueryPort {

    List<Long> findFavoritePlaceIds(long memberId);
}
