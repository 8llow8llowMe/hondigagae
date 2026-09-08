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
}
