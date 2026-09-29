package com.hondigagae.domainlayer.planner.application.model;

import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import java.util.Locale;

/**
 * 일정 생성 잡이 한 단계를 떠난 방식 (#985).
 *
 * <ul>
 *   <li>{@link #COMPLETED} — 다음 단계로 넘어갔거나, 마지막 단계에서 초안을 저장했다</li>
 *   <li>{@link #FAILED} — 워커 안에서 예외가 났거나, 다른 쪽이 먼저 타임아웃 실패를 박아 섰다</li>
 *   <li>{@link #CANCELED} — 사용자가 취소해 섰다</li>
 * </ul>
 *
 * <p>취소는 단계 경계에서 발견된다. 그래서 경계에서 취소를 본 경우에는 <b>막 끝낸 단계</b>가
 * CANCELED 로 닫힌다 — 다음 단계는 들어가지 않았으니 기록할 것이 없다. 단계 길이의 정상 분포는
 * {@code outcome="completed"} 만 보면 된다.
 */
public enum AiPlanStepOutcome {

    COMPLETED,
    FAILED,
    CANCELED;

    /**
     * 잡이 종결 상태로 끝났을 때 마지막 단계를 닫는 방식. FAILED 는 워커 자신의 실패든
     * 다른 쪽이 박은 타임아웃이든 같은 실패다.
     */
    public static AiPlanStepOutcome ofTerminal(AiPlanJobStatus status) {
        return switch (status) {
            case COMPLETED -> COMPLETED;
            case CANCELED -> CANCELED;
            case PENDING, RUNNING, FAILED -> FAILED;
        };
    }

    /** 로그·지표 태그 값. 소문자로 적는다 ({@code outcome=completed}). */
    public String tagValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
