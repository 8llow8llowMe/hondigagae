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
}
