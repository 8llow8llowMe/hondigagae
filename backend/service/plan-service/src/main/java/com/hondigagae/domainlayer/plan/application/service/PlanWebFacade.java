package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanEmergencyResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWeatherResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanPresenter;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanWeatherPresenter;
import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.domainlayer.plan.application.info.PlanEmergencyInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanSummaryInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo;
import com.hondigagae.domainlayer.plan.application.port.in.PlanWebUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanCommandProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanEmergencyProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanWeatherProcessor;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.persistence.dto.SliceResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlanWebFacade implements PlanWebUseCase {

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanCommandProcessor planCommandProcessor;
    private final PlanWeatherProcessor planWeatherProcessor;
    private final PlanEmergencyProcessor planEmergencyProcessor;
    private final PlanPresenter planPresenter;
    private final PlanWeatherPresenter planWeatherPresenter;

    /**
     * 생성·수정·상세·일자 교체에 {@code @Transactional} 을 걸지 않는다 — 반려견 확인(auth-service),
     * 장소 검증·요약(tour-service)이 원격 호출이라 트랜잭션 안에서 부르면 DB 커넥션을 잡은 채
     * 상대 응답을 기다리게 되고, tour 의 지연이 plan CRUD 전체의 커넥션 풀 고갈로 번진다
     * (architecture-guide §3 의 문서화된 예외 — 날씨·응급 브리핑과 같은 결정).
     * DB 쓰기 구간은 {@link PlanCommandProcessor} 의 메서드 단위 트랜잭션이 묶는다.
     */
    @Override
    public PlanDetailResponse createPlan(long memberId, PlanCreateCommand command) {
        List<Long> petIds = planCommandProcessor.resolvePetIds(memberId, command.petIds());
        planCommandProcessor.verifyPlaceTargets(command.items());
        Plan plan = planCommandProcessor.createPlan(memberId, command, petIds);
        return planPresenter.toDetailResponse(planQueryProcessor.getPlanDetailInfo(plan));
    }

    @Override
    @Transactional(readOnly = true)
    public SliceResponse<PlanSummaryItem> getMyPlans(long memberId, Long petId, Long lastPlanId, int size) {
        Slice<PlanSummaryInfo> slice = planQueryProcessor.getMyPlans(memberId, petId, lastPlanId, size);
        return planPresenter.toSliceResponse(slice);
    }

    @Override
    @Transactional
    public void markItemVisited(long memberId, long planId, long planItemId, boolean visited) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        planCommandProcessor.markItemVisited(plan, planItemId, visited);
    }

    /**
     * 응급 브리핑에 {@code @Transactional} 을 붙이지 않는다 — 장소 좌표·시설 검색이 전부
     * 원격 호출이라 트랜잭션 안에서 수행하면 DB 커넥션을 잡은 채 대기하게 된다.
     */
    @Override
    public PlanEmergencyResponse getPlanEmergencyBriefing(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        PlanEmergencyInfo info = planEmergencyProcessor.getEmergencyBriefing(plan);
        return planPresenter.toEmergencyResponse(info);
    }

    @Override
    public PlanDetailResponse getPlan(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        PlanInfo planInfo = planQueryProcessor.getPlanDetailInfo(plan);
        return planPresenter.toDetailResponse(planInfo);
    }

    @Override
    public PlanDetailResponse updatePlan(long memberId, long planId, PlanUpdateCommand command) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        Plan updated = planCommandProcessor.updatePlan(plan, command);
        return planPresenter.toDetailResponse(planQueryProcessor.getPlanDetailInfo(updated));
    }

    @Override
    @Transactional
    public void deletePlan(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        planCommandProcessor.softDeletePlan(plan);
    }

    @Override
    public PlanDetailResponse replaceDayItems(long memberId, long planId, int day, List<PlanItemCommand> commands) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        planCommandProcessor.verifyPlaceTargets(commands);
        planCommandProcessor.replaceDayItems(plan, day, commands);
        return planPresenter.toDetailResponse(planQueryProcessor.getPlanDetailInfo(plan));
    }

    /**
     * 일정 날씨 브리핑.
     *
     * <p><b>트랜잭션을 걸지 않는다.</b> tour-service · auth-service 원격 호출이 섞여 있어
     * DB 커넥션을 잡은 채 응답을 기다리게 되기 때문이다 (architecture-guide §3 의 문서화된 예외).
     * 소유권 확인과 항목 조회는 Processor 안의 짧은 조회로 끝난다.
     */
    @Override
    public PlanWeatherResponse getPlanWeather(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        PlanWeatherInfo info = planWeatherProcessor.brief(memberId, plan, planQueryProcessor.getPetIds(plan));
        return planWeatherPresenter.toResponse(info);
    }
}
