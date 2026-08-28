package com.hondigagae.domainlayer.favorite.domain.model;

import lombok.Builder;

/**
 * 장소 즐겨찾기. 회원과 장소의 연결만 담는다 — 장소 정보의 원천은 tour-service 이고
 * 여기에 사본을 두지 않는다(응답 시점에 내부 API 로 요약을 붙인다).
 *
 * <p>plan-service 에 두는 이유: 즐겨찾기는 "여행 후보로 찜해 둔 장소"라는 여행 준비
 * 데이터이고, 이 서비스가 이미 회원 인증과 장소 존재 검증(내부 API) 경로를 갖고 있다.
 */
@Builder
public record Favorite(
    long id,
    long memberId,
    long placeId
) {

    public boolean isOwnedBy(long memberId) {
        return this.memberId == memberId;
    }
}
