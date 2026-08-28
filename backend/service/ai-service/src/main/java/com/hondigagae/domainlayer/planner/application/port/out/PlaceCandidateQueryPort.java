package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import java.util.List;

/**
 * 일정에 넣을 후보 장소 조회 계약.
 *
 * <p><b>이 포트가 환각 방지의 핵심이다.</b> LLM 에게 "제주 관광지를 추천해"라고 물으면
 * 존재하지 않는 카페를 지어내고, 존재하더라도 반려견 동반 가능 여부는 모른다. 대신 실제 DB 에
 * 있는 동반 가능 장소 목록을 먼저 주고 <b>그 안에서만 고르게</b> 한다.
 *
 * <p>사후에 검증하는 방식보다 낫다. 검증은 틀린 답을 걸러낼 뿐이지만, 후보를 주는 방식은
 * 애초에 틀릴 자리를 없앤다 (services/ai-service.md 의 환각 방지 항목).
 */
public interface PlaceCandidateQueryPort {

    /**
     * @param areaCode 관광 지역코드 (제주=39)
     * @param size     후보 개수. 프롬프트 토큰과 선택지 다양성의 절충이다
     */
    List<PlaceCandidateQueryResult> findPetFriendlyCandidates(String areaCode, int size);

    /**
     * 아이디로 후보를 직접 가져온다 — 사용자가 필수 포함으로 지정한 장소는 검색 상위 N 에
     * 없어도 후보에 넣어야 하기 때문이다. 노출 불가 장소는 결과에서 빠진다.
     */
    List<PlaceCandidateQueryResult> findCandidatesByIds(List<Long> placeIds);
}
