package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.PackingList;

/**
 * LLM 일정 생성 계약. provider 는 adapter/out/llm 에서 분기한다.
 *
 * <p>반환 타입은 domain model이다. out-port 계약에 application의 {@code Info}를 노출하지 않는다
 * (architecture-guide §4).
 */
public interface AiLlmPort {

    AiPlanDraft generatePlanDraft(AiPlanGenerationQuery query);

    /** 반려견 여행 준비물 목록 생성. 일정 초안과 같은 "제안" 지위다 — 저장하지 않는다. */
    PackingList generatePackingList(PackingChecklistQuery query);

    /**
     * 후보 장소 목록이 필요한 구현인지.
     *
     * <p>실제 LLM 은 후보 없이 생성하면 존재하지 않는 장소를 지어내므로 반드시 필요하다.
     * 반면 스텁은 고정 샘플을 돌려주므로 필요 없다 - <b>이 구분이 없으면 스텁이 tour-service
     * 에 묶여 버려</b> 키 없이 로컬을 띄우려는 목적 자체가 무너진다.
     *
     * <p>이 판단을 어댑터가 선언하는 이유는, 근거가 provider 의 성질이기 때문이다.
     * 호출부가 "지금 스텁인가"를 알아내려 들면 그 순간 계층이 새기 시작한다.
     */
    default boolean requiresPlaceCandidates() {
        return true;
    }
}
