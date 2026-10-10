package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.model.AiPlanJobMode;
import com.hondigagae.domainlayer.planner.application.model.AiPlanStepOutcome;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import java.time.Duration;

/**
 * 일정 생성 잡의 단계별 소요를 지표로 남긴다 (#985, observability-guide.md "AI 일정 잡 지표").
 *
 * <p><b>잡을 가리키는 값은 받지 않는다.</b> jobId·memberId·areaCode 를 태그로 두면 잡마다 시계열이
 * 새로 생겨 저장소가 터진다 — 한 잡을 추적하는 것은 로그({@code AI plan job step done})의 몫이다.
 */
public interface AiPlanJobMetricsPort {

    void recordStep(AiPlanJobStep step, AiPlanJobMode mode, AiPlanStepOutcome outcome, Duration elapsed);
}
