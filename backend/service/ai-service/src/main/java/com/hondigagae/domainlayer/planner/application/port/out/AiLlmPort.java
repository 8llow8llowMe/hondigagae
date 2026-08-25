package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;

/**
 * LLM 일정 생성 계약. provider(OpenAI 호환/Ollama 등)는 adapter/out/llm 에서 분기한다.
 */
public interface AiLlmPort {

    AiPlanDraftInfo generatePlanDraft(AiPlanGenerationQuery query);
}
