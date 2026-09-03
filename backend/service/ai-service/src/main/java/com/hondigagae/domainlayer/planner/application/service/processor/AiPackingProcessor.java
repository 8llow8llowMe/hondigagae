package com.hondigagae.domainlayer.planner.application.service.processor;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.PackingListInfo;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.PlanOutlineQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.WeatherOutlookQueryPort;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 반려견 여행 준비물 목록 생성.
 *
 * <p>일정 생성과 달리 <b>동기</b>다 — 출력이 짧아(항목 8~15개) 잡·SSE 인프라를 얹는 비용이
 * 이득보다 크다. LLM 응답이 수십 초일 수 있다는 사실은 API 문서에 명시한다.
 *
 * <p>근거 셋의 강도가 다르다: 기존 일정 개요는 <b>필수</b>(무엇을 하러 가는지 모르면 준비물이
 * 성립하지 않는다), 반려견 특성·날씨 전망은 <b>관용</b>(빠지면 그만큼 일반적인 목록이 된다).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiPackingProcessor {

    private final PlanOutlineQueryPort planOutlineQueryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final WeatherOutlookQueryPort weatherOutlookQueryPort;
    private final AiLlmPort aiLlmPort;

    public PackingListInfo generatePackingList(long memberId, long planId) {
        PlanOutline outline = planOutlineQueryPort.findOutline(memberId, planId)
            .orElseThrow(() -> new AiPlanException(AiPlanErrorCode.PLAN_OUTLINE_UNAVAILABLE));

        PackingChecklistQuery query = PackingChecklistQuery.builder()
            .startDate(outline.startDate())
            .endDate(outline.endDate())
            .petConditions(loadPetConditions(memberId, outline))
            .weatherOutlook(loadWeatherOutlook(outline))
            .planOutline(outline)
            .build();

        return PackingListInfo.from(aiLlmPort.generatePackingList(query));
    }

    /**
     * 동행 반려견 <b>전체</b>의 특성.
     *
     * <p>예전에는 대표 한 마리만 봤다. 두 마리 일정에서 두 번째 이후 아이의 체중·더위/추위
     * 민감·견종이 근거에서 통째로 빠졌고, 소형견과 대형견을 함께 데려가는데 한쪽 기준
     * 준비물만 나왔다. 준비물은 항목마다 "이 여행 데이터에 근거한 이유"를 붙이는 것이 핵심인
     * 기능이라, 근거의 절반이 빠지면 그 문장 자체가 신뢰를 잃는다.
     *
     * <p>벌크로 한 번에 가져온다 (coding-conventions §9-7) - 마리 수만큼 왕복하지 않는다.
     *
     * <p>실패는 빈 목록이다. 특성이 없으면 그만큼 일반적인 목록이 될 뿐이고, auth 장애가
     * 준비물 생성 불가로 번지면 안 된다.
     */
    private List<PetCondition> loadPetConditions(long memberId, PlanOutline outline) {
        List<Long> petIds = outline.conditionPetIds();
        if (petIds.isEmpty()) {
            return List.of();
        }

        List<PetCondition> conditions = petConditionQueryPort.findConditions(memberId, petIds);
        if (conditions.size() < petIds.size()) {
            // 일부만 온 경우도 남긴다. 소유가 아닌 아이는 응답에서 빠지므로 정상일 수 있지만,
            // 조용히 줄어들면 "왜 이 아이 물건이 없지"를 추적할 단서가 없다.
            log.warn("Packing list pet conditions incomplete requested={} loaded={} memberId={}",
                petIds.size(), conditions.size(), memberId);
        }
        return conditions;
    }

    /** 여행 기간에 걸치는 전망만 남긴다. 날짜 해석이 안 되면 전망 없이 진행한다. */
    private List<DayWeatherOutlook> loadWeatherOutlook(PlanOutline outline) {
        LocalDate startDate;
        LocalDate endDate;
        try {
            startDate = LocalDate.parse(outline.startDate());
            endDate = LocalDate.parse(outline.endDate());
        } catch (RuntimeException exception) {
            log.warn("Packing list outline carried unusable dates start={} end={}",
                outline.startDate(), outline.endDate());
            return List.of();
        }
        return weatherOutlookQueryPort.findDailyOutlook(outline.areaCode()).stream()
            .filter(outlook -> !outlook.date().isBefore(startDate) && !outlook.date().isAfter(endDate))
            .toList();
    }
}
