package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceWalkSafetyQueryResult;
import java.time.LocalDateTime;
import java.util.Optional;

/** 장소 산책 위험도 조회 계약. tour-service 가 시각 기준으로 산출한 결과를 그대로 받는다. */
public interface PlaceWalkSafetyQueryPort {

    /**
     * @return 조회에 실패하면 {@code Optional.empty()}. 항목 하나가 비어도 나머지 항목은 보여 준다
     */
    Optional<PlaceWalkSafetyQueryResult> findWalkSafety(
        long placeId, LocalDateTime targetDateTime, PetConditionQueryResult pet);
}
