package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** 반려견 특성 조회 계약. 원천은 auth-service 이고 이 서비스는 사본을 두지 않는다. */
public interface PetConditionQueryPort {

    /**
     * 여러 마리 특성을 <b>한 번에</b> 가져온다 — 마리 수만큼 왕복하지 않는다 (coding-conventions §9-7).
     *
     * @return petId → 특성. 본인 소유가 아니거나 없는 반려견, 그리고 조회에 실패한 경우는 키가
     *         없다. 호출한 쪽이 {@link PetConditionQueryResult#unknown()} 으로 채운다 —
     *         반려견 특성이 없다고 일정 날씨까지 못 보여 줄 이유는 없다
     */
    Map<Long, PetConditionQueryResult> findConditions(long memberId, List<Long> petIds);

    /**
     * 대표 반려견 아이디. 요청이 반려견을 지정하지 않았을 때의 기본값이다.
     *
     * @return 대표 반려견이 없거나 조회에 실패하면 empty
     */
    Optional<Long> findRepresentativePetId(long memberId);

    /**
     * 요청 petIds 중 <b>본인 소유로 확인된 것만</b> 돌려준다. 일정 생성의 소유 검증용이라
     * {@link #findConditions} 와 달리 조회 실패를 빈 값으로 접지 않는다 — 접으면 "남의 반려견" 과
     * "auth-service 장애" 가 같은 결과가 되어, 장애 때 정상 요청이 소유 위반으로 거절된다.
     *
     * @throws com.hondigagae.domainlayer.plan.application.exception.PlanException 조회 실패 시 503
     */
    Set<Long> findOwnedPetIds(long memberId, List<Long> petIds);
}
