package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo.AiPlanDayInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo.AiPlanItemInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo.AiPlanReasonInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * LLM 스텁 어댑터 — LLM provider 확정 시 교체한다.
 *
 * <p>실제 LLM 미연동 상태에서 비동기 잡 파이프라인(제출→폴링→완료)을 end-to-end로 검증하기 위한
 * 고정 샘플 응답을 반환한다. 교체 시 이 클래스 대신 provider별 어댑터(OpenAI 호환/Ollama 등)를
 * {@link AiLlmPort} 구현으로 등록하고, 서킷 인스턴스 {@code llm}과 timeout을 반드시 적용한다
 * (coding-conventions §10).
 */
@Slf4j
@Component
public class StubLlmAdapter implements AiLlmPort {

    @Override
    public AiPlanDraftInfo generatePlanDraft(AiPlanGenerationQuery query) {
        simulateLatency();

        int days = resolveDayCount(query);
        List<AiPlanDayInfo> dayInfos = new ArrayList<>();
        for (int day = 1; day <= days; day++) {
            dayInfos.add(sampleDay(day, days));
        }

        return AiPlanDraftInfo.builder()
            .days(dayInfos)
            .reasons(List.of(
                AiPlanReasonInfo.builder()
                    .code("PET_ALLOWED")
                    .name("반려견 동반 가능")
                    .description("추천 장소는 모두 반려견 출입이 가능한 시설로만 구성했습니다.")
                    .build(),
                AiPlanReasonInfo.builder()
                    .code("LOW_CONGESTION")
                    .name("혼잡도 낮음")
                    .description("관광지 집중률 예측이 낮은 시간대 위주로 동선을 배치했습니다.")
                    .build(),
                AiPlanReasonInfo.builder()
                    .code("WEATHER_OK")
                    .name("기온 적정")
                    .description("여행 기간 예보 기온이 반려견 야외 활동에 적합한 범위입니다.")
                    .build()
            ))
            .build();
    }

    private AiPlanDayInfo sampleDay(int day, int totalDays) {
        List<AiPlanItemInfo> items = new ArrayList<>();
        if (day == 1) {
            items.add(item("MEAL", "애견 동반 식당 점심", "테라스 좌석 반려견 동반 가능"));
            items.add(item("LODGING", "숙소 체크인", "반려견 동반 가능 숙소"));
            items.add(item("PLACE", "애견 카페", "실내 놀이 공간 보유"));
            items.add(item("WALK", "해안 산책로 산책", "목줄 착용 필수"));
        } else if (day == totalDays) {
            items.add(item("MEAL", "브런치 카페", "반려견 동반 가능"));
            items.add(item("PLACE", "기념품 상점", "소형견 안고 입장 가능"));
            items.add(item("MOVE", "공항 이동", "이동 시간 여유 확보"));
        } else {
            items.add(item("PLACE", "오름 트레킹", "완만한 코스, 반려견 동반 가능"));
            items.add(item("MEAL", "향토 음식점 저녁", "야외 좌석 반려견 동반 가능"));
            items.add(item("PLACE", "해변 산책", "백사장 반려견 출입 가능 구역"));
        }
        return AiPlanDayInfo.builder().day(day).items(items).build();
    }

    private AiPlanItemInfo item(String itemType, String title, String note) {
        return AiPlanItemInfo.builder().itemType(itemType).title(title).note(note).build();
    }

    private int resolveDayCount(AiPlanGenerationQuery query) {
        try {
            LocalDate start = LocalDate.parse(query.startDate());
            LocalDate end = LocalDate.parse(query.endDate());
            return (int) (end.toEpochDay() - start.toEpochDay()) + 1;
        } catch (RuntimeException exception) {
            log.warn("AI plan stub failed to parse date range, fallback to 1 day. reason={}", exception.getMessage());
            return 1;
        }
    }

    private void simulateLatency() {
        try {
            Thread.sleep(1_500L);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AiPlanException(AiPlanErrorCode.LLM_UNAVAILABLE, exception);
        }
    }
}
