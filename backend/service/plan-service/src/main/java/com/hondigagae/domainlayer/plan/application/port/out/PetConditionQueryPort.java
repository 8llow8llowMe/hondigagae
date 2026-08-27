package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;

/** 반려견 특성 조회 계약. 원천은 auth-service 이고 이 서비스는 사본을 두지 않는다. */
public interface PetConditionQueryPort {

    /**
     * @return 조회에 실패하면 {@link PetConditionQueryResult#unknown()}.
     *         반려견 특성이 없다고 일정 날씨까지 못 보여 줄 이유는 없다
     */
    PetConditionQueryResult findCondition(long memberId, long petId);
}
