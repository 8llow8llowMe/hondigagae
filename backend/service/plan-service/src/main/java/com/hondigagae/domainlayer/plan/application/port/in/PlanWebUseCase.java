package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWeatherResponse;
import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.persistence.dto.SliceResponse;
import java.util.List;

public interface PlanWebUseCase {

    PlanDetailResponse createPlan(long memberId, PlanCreateCommand command);

    SliceResponse<PlanSummaryItem> getMyPlans(long memberId, Long lastPlanId, int size);

    PlanDetailResponse getPlan(long memberId, long planId);

    PlanDetailResponse updatePlan(long memberId, long planId, PlanUpdateCommand command);

    void deletePlan(long memberId, long planId);

    PlanDetailResponse replaceDayItems(long memberId, long planId, int day, List<PlanItemCommand> commands);

    /**
     * 일정의 날씨 브리핑. 본인 일정만 조회된다.
     *
     * <p>일정 자체를 바꾸지 않는 조회이다. 날씨 때문에 항목을 바꾸는 것은
     * {@link #replaceDayItems} 로 명시적으로 하도록 나눈다 (api-design-guide §8).
     */
    PlanWeatherResponse getPlanWeather(long memberId, long planId);
}
