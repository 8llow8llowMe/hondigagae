package com.hondigagae.domainlayer.planner.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 담은 일정 아이디의 응답 변환 (#970).
 *
 * <p>일정 아이디는 Snowflake 라 숫자로 나가면 자바스크립트가 <b>예외 없이</b> 반올림해, 화면의
 * "담은 일정 보기" 링크가 엉뚱한 일정(대개 404)을 가리킨다 (coding-conventions §7-1). 폴링과 SSE 가
 * 모두 이 Presenter 를 지나므로 문자열 변환을 여기서 고정한다.
 */
class AiPlanJobCommittedPlanPresenterTest {

    private final AiPlanPresenter presenter = new AiPlanPresenter();

    @Test
    @DisplayName("담은 일정 아이디를 문자열로 내린다 — Snowflake 정밀도")
    void writesCommittedPlanIdAsString() {
        AiPlanJobStatusResponse response = presenter.toJobStatusResponse(AiPlanJobInfo.builder()
            .jobId("8a64f9c0").status(AiPlanJobStatus.COMPLETED).committedPlanId(1234567890123456789L)
            .build());

        assertThat(response.committedPlanId()).isEqualTo("1234567890123456789");
    }

    @Test
    @DisplayName("담은 적이 없으면 null 을 유지한다 — 빈 문자열이나 \"null\" 이 아니다")
    void keepsNullWhenNotCommitted() {
        AiPlanJobStatusResponse response = presenter.toJobStatusResponse(AiPlanJobInfo.builder()
            .jobId("8a64f9c0").status(AiPlanJobStatus.COMPLETED)
            .build());

        assertThat(response.committedPlanId()).isNull();
    }
}
