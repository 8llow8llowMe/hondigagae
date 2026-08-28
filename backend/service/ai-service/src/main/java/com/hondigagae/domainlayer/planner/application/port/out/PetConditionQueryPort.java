package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import java.util.Optional;

/**
 * 반려견 특성 조회 계약.
 *
 * <p>비어 있으면 특성 없이 진행한다 — auth-service 장애나 프로필 부재가
 * 일정 생성 자체를 막으면 안 된다. 대신 프롬프트에서 반려견 절이 빠진다.
 */
public interface PetConditionQueryPort {

    Optional<PetCondition> findCondition(long memberId, long petId);
}
