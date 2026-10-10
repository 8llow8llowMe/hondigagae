package com.hondigagae.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 스케줄러 활성화. 현재는 동행 반려견 대사({@code PlanCompanionReconcileScheduler})가 쓴다.
 *
 * <p>분산 락이 없으므로 <b>다중 인스턴스에서 동시에 돌아도 안전하다는 근거가 작업마다 있어야</b>
 * 한다. "멱등이니까" 는 근거가 되지 않는다 — 대사는 같은 일정에서 서로 다른 행을 나눠 지우면
 * 동행견 0마리라는 <b>어느 쪽도 의도하지 않은 결과</b>를 만들 수 있고, 그건 재실행으로 덮이지 않는다.
 *
 * <p>대사의 근거는 <b>일정 행 비관 잠금</b>이다. 정리 트랜잭션이 일정 행을 잠그고 다시 읽으므로
 * 같은 일정을 처리하는 실행끼리 직렬화되고, 뒤에 온 쪽이 앞 실행의 결과를 보고 판단한다
 * ({@code PlanRepository.findActiveByIdForUpdate}). 잠금 구간에 원격 호출은 없다.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {

}
