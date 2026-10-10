package com.hondigagae.domainlayer.planner.domain.model;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum AiPlanJobStatus implements CodeNameDescribable {

    PENDING("대기 중", "작업이 큐에서 실행을 기다리고 있습니다."),
    RUNNING("생성 중", "AI가 반려견 맞춤 여행 일정을 생성하고 있습니다."),
    COMPLETED("완료", "여행 일정 생성이 완료되었습니다."),
    FAILED("실패", "여행 일정 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."),
    CANCELED("취소됨", "사용자가 작업을 취소했습니다.");

    private final String displayName;
    private final String description;

    /**
     * 더 바뀌지 않는 상태인지. SSE 는 여기서 연결을 닫는다.
     *
     * <p>{@code CANCELED} 가 종결에 들어가야 취소한 순간 스트림이 닫힌다 — 빠지면 대기 화면이
     * 취소를 눌러 놓고도 하트비트 타임아웃까지 열려 있는다.
     */
    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == CANCELED;
    }

    /** 취소할 수 있는 상태인지. 이미 끝난 작업은 취소할 것이 없다. */
    public boolean isCancelable() {
        return isInFlight();
    }

    public boolean isInFlight() {
        return this == PENDING || this == RUNNING;
    }
}
