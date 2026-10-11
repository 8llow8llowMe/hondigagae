package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.application.model.AlternativePlaceCriteria;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.insight.domain.model.RecommendationCandidate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 판정 대상 장소 조회 계약.
 *
 * <p>반환 타입은 domain model 이다. 필요한 모양(좌표 + 동반 조건 + 실내외)이 그대로
 * 판정 입력이라 중간 {@code QueryResult} 를 한 겹 더 둘 이유가 없다
 * (coding-conventions §12-2 — 영속성 포트는 MapStruct 를 거친 domain/model 을 넘긴다).
 */
public interface PlaceProfileQueryPort {

    Optional<PlaceCondition> findProfile(long placeId);

    /**
     * 비 오는 날 대체할 실내 장소 후보. 반경 안에서 실내가 <b>확인된</b> 곳만 준다.
     *
     * <p>실내 여부가 null 인 장소는 후보에서 뺀다. 식약처 원천이 실내외를 주지 않아 null 이
     * 흔한데, 그것을 실내로 오해해 추천하면 비 맞으러 보내는 셈이 된다.
     */
    List<PlaceCondition> findIndoorAlternatives(AlternativePlaceCriteria criteria);

    /**
     * 장소 추천 후보 (#1368). 한 번의 질의로 지역 안의 후보 전부를 준다.
     *
     * <p>병합 · 숨김 행, 동반 불가 · 미확인 장소, 대표 사진이 없거나 좌표가 없는 장소는 뺀다. 좌표가 없으면 날씨를 붙일
     * 수 없어 점수를 못 내고, 사진이 없으면 홈 카드로 그릴 수 없다. 동반 미확인(UNKNOWN)을 빼는 이유는 "가기 좋은
     * 곳" 이라고 내민 곳에서 반려견이 못 들어가면 추천 자체가 거짓이 되기 때문이다.
     */
    List<RecommendationCandidate> findRecommendationCandidates(String areaCode, Collection<String> contentTypeIds);
}
