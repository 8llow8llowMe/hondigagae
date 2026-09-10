package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanBriefingResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanEmergencyResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWeatherResponse;
import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.persistence.dto.SliceResponse;
import java.time.LocalDate;
import java.util.List;

public interface PlanWebUseCase {

    PlanDetailResponse createPlan(long memberId, PlanCreateCommand command);

    SliceResponse<PlanSummaryItem> getMyPlans(long memberId, Long petId, Long lastPlanId, int size);

    PlanDetailResponse getPlan(long memberId, long planId);

    PlanDetailResponse updatePlan(long memberId, long planId, PlanUpdateCommand command);

    void deletePlan(long memberId, long planId);

    PlanDetailResponse replaceDayItems(long memberId, long planId, int day, List<PlanItemCommand> commands);

    void markItemVisited(long memberId, long planId, long planItemId, boolean visited);

    PlanEmergencyResponse getPlanEmergencyBriefing(long memberId, long planId);

    /**
     * 일정의 날씨 브리핑. 본인 일정만 조회된다.
     *
     * <p>일정 자체를 바꾸지 않는 조회이다. 날씨 때문에 항목을 바꾸는 것은
     * {@link #replaceDayItems} 로 명시적으로 하도록 나눈다 (api-design-guide §8).
     */
    PlanWeatherResponse getPlanWeather(long memberId, long planId);

    /**
     * 하루치 여행 브리핑 — 그날 일정 요약 + 날씨 + 기상특보 + 산책 골든타임. 본인 일정만 조회된다.
     *
     * <p>전부 결정적 조합이고 LLM 을 부르지 않는다. 특보·골든타임은 {@code date} 가 오늘일 때만
     * 붙는다 — tour-service 의 골든타임이 오늘 남은 시간 전용이고, 특보는 발효 중인 것만 있기 때문이다.
     *
     * @param date 브리핑할 날짜. 일정 기간 밖이면 {@code PLAN_002}
     */
    PlanBriefingResponse getPlanBriefing(long memberId, long planId, LocalDate date);
}
