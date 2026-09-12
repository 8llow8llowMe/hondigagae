package com.hondigagae.domainlayer.planner.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;
import com.hondigagae.domainlayer.planner.application.info.AiPlanConditionsInfo;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 제출 조건 → 저장 파라미터 → 조회 응답 조건의 왕복 검증 (#488).
 *
 * <p>조건은 <b>새로 저장하지 않는다.</b> 제출 때 이미 저장된 {@code requestParams} 를 되돌려
 * 내리므로, 쓰는 쪽({@link AiPlanJobProcessor#toParams})과 읽는 쪽
 * ({@link AiPlanConditionsInfo#from})이 같은 키를 봐야 한다. 둘은 문자열 키로만 이어져 있어
 * 컴파일러가 잡아 주지 못한다 — 키 하나가 어긋나면 화면은 "조건을 다시 알려 주세요" 로
 * 돌아가고, 그 증상은 다른 브라우저에서 열어 봐야만 보인다.
 */
class AiPlanJobConditionsRoundTripTest {

    @Test
    @DisplayName("제출 조건이 저장 파라미터를 거쳐 그대로 돌아온다")
    void roundTripsEveryCondition() {
        AiPlanCreateCommand command = AiPlanCreateCommand.builder()
            .areaCode("39").sigunguCode("4")
            .startDate(LocalDate.of(2026, 9, 11)).endDate(LocalDate.of(2026, 9, 13))
            .budget(400_000L)
            .petIds(List.of(1234567890123456789L, 1234567890123456790L))
            .pinnedPlaceIds(List.of(212481712381923328L))
            .requestNote("산책 위주로 부탁해요")
            .preferFavorites(true)
            .build();

        AiPlanConditionsInfo conditions = AiPlanConditionsInfo.from(AiPlanJobProcessor.toParams(command));

        assertThat(conditions.areaCode()).isEqualTo("39");
        assertThat(conditions.sigunguCode()).isEqualTo("4");
        assertThat(conditions.startDate()).isEqualTo(LocalDate.of(2026, 9, 11));
        assertThat(conditions.endDate()).isEqualTo(LocalDate.of(2026, 9, 13));
        assertThat(conditions.budget()).isEqualTo(400_000L);
        assertThat(conditions.petIds()).containsExactly(1234567890123456789L, 1234567890123456790L);
        assertThat(conditions.requestNote()).isEqualTo("산책 위주로 부탁해요");
    }

    @Test
    @DisplayName("생략한 조건은 null 로 돌아온다 — 빈 문자열을 그대로 내리지 않는다")
    void foldsOmittedConditionsToNull() {
        // 저장은 생략값을 빈 문자열로 적는다. 그대로 내리면 화면이 "메모 없음" 과 "빈 메모" 를 구분하지 못한다.
        AiPlanCreateCommand command = AiPlanCreateCommand.builder()
            .areaCode("39")
            .startDate(LocalDate.of(2026, 9, 11)).endDate(LocalDate.of(2026, 9, 11))
            .petIds(List.of()).pinnedPlaceIds(List.of())
            .build();

        AiPlanConditionsInfo conditions = AiPlanConditionsInfo.from(AiPlanJobProcessor.toParams(command));

        assertThat(conditions.sigunguCode()).isNull();
        assertThat(conditions.budget()).isNull();
        assertThat(conditions.requestNote()).isNull();
        // 반려견을 지정하지 않은 제출이다. null 이 아니라 빈 목록으로 둔다 — 워커가 대표 반려견으로 대신했다.
        assertThat(conditions.petIds()).isEmpty();
    }

    @Test
    @DisplayName("저장된 파라미터가 없으면 조건 블록 자체가 없다")
    void yieldsNoBlockWithoutParams() {
        assertThat(AiPlanConditionsInfo.from(null)).isNull();
        assertThat(AiPlanConditionsInfo.from(Map.of())).isNull();
    }

    @Test
    @DisplayName("해석할 수 없는 값은 그 칸만 비운다 — 손상된 조건 하나가 작업 조회를 막으면 안 된다")
    void foldsUnreadableValuesInsteadOfThrowing() {
        // 던지면 폴링은 코드 없는 500 이 되고, SSE 는 구독 콜백이 예외를 삼켜 조용히 멈춘다.
        // 조건은 초안에 덧붙는 값이라 못 읽는 칸 하나가 작업 전체를 못 보게 만들 이유가 없다.
        Map<String, String> corrupted = Map.of(
            "areaCode", "39",
            "startDate", "2026-13-99",
            "endDate", "2026-09-13",
            "budget", "사십만원",
            "petIds", "1,없음,3",
            "requestNote", "실내 위주로"
        );

        AiPlanConditionsInfo conditions = AiPlanConditionsInfo.from(corrupted);

        assertThat(conditions.startDate()).isNull();
        assertThat(conditions.budget()).isNull();
        // 원소 하나만 버리면 "두 마리 중 한 마리로 짰다" 는 거짓말이 남는다. 목록째 비운다.
        assertThat(conditions.petIds()).isEmpty();
        // 읽을 수 있는 칸은 그대로 살아남는다.
        assertThat(conditions.areaCode()).isEqualTo("39");
        assertThat(conditions.endDate()).isEqualTo(LocalDate.of(2026, 9, 13));
        assertThat(conditions.requestNote()).isEqualTo("실내 위주로");
    }

    @Test
    @DisplayName("저장 키 집합을 고정한다 — 읽는 쪽이 둘이라 이름 하나가 바뀌면 조용히 어긋난다")
    void pinsStoredParamKeys() {
        // 읽는 쪽: AiPlanConditionsInfo#from (조회 응답) 과 AiPlanWorker#toQuery (LLM 질의).
        // 후자는 조건이 빠져도 예외 없이 "조건 없는 일정" 을 만들어 버려서, 키를 바꾼 사람이
        // 워커까지 손봤는지 잡아 줄 자리가 여기밖에 없다.
        AiPlanCreateCommand command = AiPlanCreateCommand.builder()
            .areaCode("39")
            .startDate(LocalDate.of(2026, 9, 11)).endDate(LocalDate.of(2026, 9, 11))
            .petIds(List.of()).pinnedPlaceIds(List.of())
            .build();

        assertThat(AiPlanJobProcessor.toParams(command)).containsOnlyKeys(
            "areaCode", "sigunguCode", "startDate", "endDate", "budget",
            "petIds", "pinnedPlaceIds", "preferFavorites", "planId", "regenerateDay", "requestNote"
        );
    }
}
