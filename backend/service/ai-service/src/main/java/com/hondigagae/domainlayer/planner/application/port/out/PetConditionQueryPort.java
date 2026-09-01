package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import java.util.List;
import java.util.Optional;

/**
 * 반려견 특성 조회 계약.
 *
 * <p>비어 있으면 특성 없이 진행한다 — auth-service 장애나 프로필 부재가
 * 일정 생성 자체를 막으면 안 된다. 대신 프롬프트에서 반려견 절이 빠진다.
 */
public interface PetConditionQueryPort {

    Optional<PetCondition> findCondition(long memberId, long petId);

    /**
     * 여러 마리 특성을 한 번에 조회한다(원격 N+1 방지, §9-7). 소유가 아니거나 없는 petId 는
     * 결과에서 빠지며, 조회 실패는 빈 목록으로 관용 처리된다.
     */
    List<PetCondition> findConditions(long memberId, List<Long> petIds);

    /** 대표 반려견 특성. 요청이 반려견을 지정하지 않았을 때의 기본값이다. */
    Optional<PetCondition> findRepresentativeCondition(long memberId);
}
