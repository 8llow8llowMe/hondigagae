package com.hondigagae.domainlayer.planner.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import java.time.Instant;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code stepStartedAt} 의 응답 모양 (#985). 폴링과 SSE 가 모두 이 Presenter 를 지나므로 형식을 여기서 고정한다.
 */
class AiPlanJobStepStartedAtPresenterTest {

    private final AiPlanPresenter presenter = new AiPlanPresenter();

    @Test
    @DisplayName("오프셋이 붙은 ISO-8601 (KST, 밀리초까지) 로 내린다")
    void writesOffsetIsoText() {
        AiPlanJobStatusResponse response = presenter.toJobStatusResponse(AiPlanJobInfo.builder()
            .jobId("8a64f9c0").status(AiPlanJobStatus.RUNNING).step(AiPlanJobStep.WEATHER)
            .stepStartedAt(Instant.parse("2026-09-30T05:03:12.345678901Z"))
            .build());

        assertThat(response.stepStartedAt()).isEqualTo("2026-09-30T14:03:12.345+09:00");
        // 화면이 그대로 파싱해 같은 순간을 얻는다.
        assertThat(OffsetDateTime.parse(response.stepStartedAt()).toInstant()).isEqualTo(Instant.parse("2026-09-30T05:03:12.345Z"));
    }

    @Test
    @DisplayName("값이 없으면 null 이다 — 빈 문자열이 아니다")
    void keepsNull() {
        AiPlanJobStatusResponse response = presenter.toJobStatusResponse(AiPlanJobInfo.builder()
            .jobId("8a64f9c0").status(AiPlanJobStatus.PENDING)
            .build());

        assertThat(response.stepStartedAt()).isNull();
    }
}
