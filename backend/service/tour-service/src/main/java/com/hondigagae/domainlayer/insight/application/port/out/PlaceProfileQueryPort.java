package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.application.model.AlternativePlaceCriteria;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
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
}
