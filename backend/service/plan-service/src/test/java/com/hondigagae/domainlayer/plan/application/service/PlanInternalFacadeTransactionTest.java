package com.hondigagae.domainlayer.plan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

/**
 * 반려견 삭제 트리거(#972)의 트랜잭션 경계를 고정한다.
 *
 * <p>{@code reconcileCompanions} 안에는 auth-service 원격 조회가 있다. 누군가 "쓰기니까" 하고 파사드에
 * {@code @Transactional} 을 붙이면 DB 커넥션을 잡은 채 auth 응답을 기다리게 되고, 일정 하나 실패가
 * 이미 정리한 일정까지 롤백한다. 컴파일도 다른 테스트도 그 변화를 잡지 못해 여기서 막는다.
 */
class PlanInternalFacadeTransactionTest {

    @Test
    @DisplayName("동행 대사 트리거는 파사드에서 트랜잭션을 열지 않는다 — 일정 단위 트랜잭션은 PlanPetDetachProcessor 가 연다")
    void reconcileCompanionsIsNotTransactional() throws NoSuchMethodException {
        Method method = PlanInternalFacade.class.getMethod("reconcileCompanions", long.class);

        assertThat(method.isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(PlanInternalFacade.class.isAnnotationPresent(Transactional.class)).isFalse();
    }
}
