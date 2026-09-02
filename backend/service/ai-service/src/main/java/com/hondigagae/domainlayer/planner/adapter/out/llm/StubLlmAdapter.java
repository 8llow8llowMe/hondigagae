package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.domain.model.PackingList;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * LLM 스텁 어댑터 — API 키 없이 파이프라인을 돌려 보기 위한 구현.
 *
 * <p>비동기 잡 파이프라인(제출→폴링→완료)을 end-to-end 로 검증하기 위한 고정 샘플 응답이다.
 *
 * <p><b>삭제하지 않고 남겨 둔다.</b> 실제 구현은
 * {@code AnthropicClaudeLlmAdapter} 로 들어왔지만, 프론트 개발과 CI 가 API 키와 토큰 비용에
 * 묶이면 안 되기 때문이다. {@code ai-llm.enabled=false}(기본값)이면 이쪽이 뜨고,
 * 그 상태에서도 제출→폴링→완료 흐름은 똑같이 동작한다.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "ai-llm", name = "enabled", havingValue = "false", matchIfMissing = true)
public class StubLlmAdapter implements AiLlmPort {

    /**
     * 고정 샘플을 돌려주므로 후보 장소가 필요 없다.
     *
     * <p>이걸 선언하지 않으면 워커가 tour-service 에서 후보를 받아 오려다,
     * tour-service 가 떠 있지 않은 로컬에서 스텁 경로까지 함께 실패한다.
     */
    @Override
    public boolean requiresPlaceCandidates() {
        return false;
    }

    @Override
    public PackingList generatePackingList(PackingChecklistQuery query) {
        simulateLatency();
        return PackingList.builder()
            .items(java.util.List.of(
                PackingList.PackingItem.builder().category("필수").name("목줄·인식표")
                    .reason("제주 여행지 대부분이 목줄 착용을 요구합니다.").build(),
                PackingList.PackingItem.builder().category("필수").name("배변봉투")
                    .reason("산책·야외 일정이 포함된 여행의 기본 준비물입니다.").build(),
                PackingList.PackingItem.builder().category("반려견 케어").name("휴대용 물그릇과 생수")
                    .reason("야외 이동 중 수분 보충이 필요합니다.").build(),
                PackingList.PackingItem.builder().category("이동").name("차량용 안전벨트 리드")
                    .reason("공항·숙소 간 차량 이동이 있는 일정입니다.").build()))
            .build();
    }

    @Override
    public AiPlanDraft generatePlanDraft(AiPlanGenerationQuery query) {
        simulateLatency();

        int days = resolveDayCount(query);
        List<AiPlanDraftDay> draftDays = new ArrayList<>();
        for (int day = 1; day <= days; day++) {
            draftDays.add(sampleDay(day, days));
        }

        return AiPlanDraft.builder()
            .days(draftDays)
            .reasons(List.of(
                AiPlanDraftReason.builder()
                    .code("PET_ALLOWED")
                    .name("반려견 동반 가능")
                    .description("추천 장소는 모두 반려견 출입이 가능한 시설로만 구성했습니다.")
                    .build(),
                AiPlanDraftReason.builder()
                    .code("LOW_CONGESTION")
                    .name("혼잡도 낮음")
                    .description("관광지 집중률 예측이 낮은 시간대 위주로 동선을 배치했습니다.")
                    .build(),
                AiPlanDraftReason.builder()
                    .code("WEATHER_OK")
                    .name("기온 적정")
                    .description("여행 기간 예보 기온이 반려견 야외 활동에 적합한 범위입니다.")
                    .build()
            ))
            .build();
    }

    private AiPlanDraftDay sampleDay(int day, int totalDays) {
        List<AiPlanDraftItem> items = new ArrayList<>();
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
        return AiPlanDraftDay.builder().day(day).items(items).build();
    }

    private AiPlanDraftItem item(String itemType, String title, String note) {
        return AiPlanDraftItem.builder().itemType(itemType).title(title).note(note).build();
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
