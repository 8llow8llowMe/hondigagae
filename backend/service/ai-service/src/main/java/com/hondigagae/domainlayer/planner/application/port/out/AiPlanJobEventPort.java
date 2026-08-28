package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;

/**
 * AI 일정 잡 상태 변경을 인스턴스 간에 전파하는 포트.
 * SSE 연결을 잡은 인스턴스와 잡을 실행하는 워커 인스턴스가 다를 수 있어 저장소 밖의 브로드캐스트가 필요하다.
 */
public interface AiPlanJobEventPort {

    /**
     * 잡 상태가 변경되었음을 알린다. 이벤트는 최선 노력(best-effort)으로 전달되며,
     * 유실 시에도 SSE 하트비트의 상태 재확인과 폴링 폴백이 종결을 보장한다.
     */
    void publishJobUpdated(String jobId);

    AiPlanJobSubscription subscribe(String jobId, Runnable onJobUpdated);
}
