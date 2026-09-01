package com.hondigagae.domainlayer.pet.application.port.in;

import com.hondigagae.domainlayer.pet.adapter.in.internal.dto.PetConditionResponse;

/**
 * 서비스 간 호출 전용 유스케이스 (coding-conventions §5).
 *
 * <p>반려견 프로필의 원천은 이 서비스다. 다른 서비스가 사본을 두는 대신 필요한 특성만
 * 가져가게 한다 - 사본을 두면 사용자가 프로필을 고쳐도 옛 값으로 판정하는 일이 생긴다.
 *
 * <p>웹 유스케이스와 분리한 이유는 <b>인가 방식이 다르기 때문</b>이다. 웹은 로그인한 본인만
 * 자기 반려견을 보지만, 내부 호출은 이미 소유권을 확인한 서비스(plan-service)가 부른다.
 * 그래서 memberId 를 함께 받아 여기서도 소유권을 다시 확인한다 - 호출한 쪽을 믿지 않는다.
 */
public interface PetInternalUseCase {

    PetConditionResponse getPetCondition(long memberId, long petId);

    /** 대표 반려견의 특성. 호출부가 petId 를 받지 않았을 때의 기본값으로 쓴다. */
    PetConditionResponse getRepresentativePetCondition(long memberId);

    /**
     * 여러 마리의 특성을 한 번에 준다 — 마리 수만큼 HTTP 왕복이 생기는 원격 N+1 방지용(§9-7).
     * 본인 소유가 아니거나 없는 petId 는 결과에서 조용히 빠진다 — 호출부가 누락으로 판단한다.
     */
    java.util.List<PetConditionResponse> getPetConditions(long memberId, java.util.List<Long> petIds);
}
