package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import java.time.LocalDate;
import java.util.Optional;

/** 장소 적합도 조회 계약. tour-service 가 규칙으로 산출한 결과를 그대로 받는다. */
public interface PlaceSuitabilityQueryPort {

    /**
     * @return 조회에 실패하면 {@code Optional.empty()}. 하루치가 비어도 나머지 일자는 보여 준다
     */
    Optional<PlaceSuitabilityQueryResult> findSuitability(long placeId, LocalDate targetDate, PetConditionQueryResult pet);
}
