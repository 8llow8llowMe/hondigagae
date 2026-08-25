package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;

/**
 * LLM 일정 생성 계약. provider(OpenAI 호환/Ollama 등)는 adapter/out/llm 에서 분기한다.
 *
 * <p>반환 타입은 domain model이다. out-port 계약에 application의 {@code Info}를 노출하지 않는다
 * (architecture-guide §4).
 */
public interface AiLlmPort {

    AiPlanDraft generatePlanDraft(AiPlanGenerationQuery query);
}
