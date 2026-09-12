package com.hondigagae.domainlayer.planner.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.application.info.AiPlanConditionsInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 생성 조건의 응답 변환 검증 (#488).
 *
 * <p>{@code petIds} 가 숫자로 나가면 자바스크립트가 <b>예외 없이</b> 반올림해, 화면은 멀쩡히
 * 그려지는데 그 아이디로 일정을 담는 순간에만 실패한다 (coding-conventions §7-1). 문자열
 * 변환은 Presenter 가 경계라서 여기서 고정한다.
 */
class AiPlanJobConditionsPresenterTest {

    private final AiPlanPresenter presenter = new AiPlanPresenter();

    @Test
    @DisplayName("반려견 식별자를 문자열로 내린다 — Snowflake 정밀도")
    void writesPetIdsAsStrings() {
        AiPlanJobStatusResponse response = presenter.toJobStatusResponse(jobInfo(AiPlanConditionsInfo.builder()
            .areaCode("39").sigunguCode("4")
            .startDate(LocalDate.of(2026, 9, 11)).endDate(LocalDate.of(2026, 9, 13))
            .petIds(List.of(1234567890123456789L)).budget(400_000L).requestNote("실내 위주로")
            .build()));

        assertThat(response.conditions().petIds()).containsExactly("1234567890123456789");
        assertThat(response.conditions().areaCode()).isEqualTo("39");
        assertThat(response.conditions().sigunguCode()).isEqualTo("4");
        assertThat(response.conditions().startDate()).isEqualTo(LocalDate.of(2026, 9, 11));
        assertThat(response.conditions().endDate()).isEqualTo(LocalDate.of(2026, 9, 13));
        assertThat(response.conditions().budget()).isEqualTo(400_000L);
        assertThat(response.conditions().requestNote()).isEqualTo("실내 위주로");
    }

    @Test
    @DisplayName("생략 가능한 조건은 null 을 유지하고, 반려견 미지정은 빈 배열이다")
    void keepsOmittedConditionsNull() {
        AiPlanJobStatusResponse response = presenter.toJobStatusResponse(jobInfo(AiPlanConditionsInfo.builder()
            .areaCode("39")
            .startDate(LocalDate.of(2026, 9, 11)).endDate(LocalDate.of(2026, 9, 11))
            .petIds(List.of())
            .build()));

        assertThat(response.conditions().sigunguCode()).isNull();
        assertThat(response.conditions().budget()).isNull();
        assertThat(response.conditions().requestNote()).isNull();
        assertThat(response.conditions().petIds()).isEmpty();
    }

    @Test
    @DisplayName("대기 중인 작업에도 조건이 실린다 — 초안보다 먼저 필요한 값이다")
    void carriesConditionsWhilePending() {
        AiPlanJobInfo pending = AiPlanJobInfo.builder()
            .jobId("8a64f9c0").status(AiPlanJobStatus.PENDING)
            .conditions(AiPlanConditionsInfo.builder()
                .areaCode("39")
                .startDate(LocalDate.of(2026, 9, 11)).endDate(LocalDate.of(2026, 9, 11))
                .petIds(List.of(1L))
                .build())
            .build();

        AiPlanJobStatusResponse response = presenter.toJobStatusResponse(pending);

        assertThat(response.planDraft()).isNull();
        assertThat(response.step()).isNull();
        assertThat(response.conditions().areaCode()).isEqualTo("39");
    }

    private AiPlanJobInfo jobInfo(AiPlanConditionsInfo conditions) {
        return AiPlanJobInfo.builder()
            .jobId("8a64f9c0").status(AiPlanJobStatus.COMPLETED).conditions(conditions)
            .build();
    }
}
