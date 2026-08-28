package com.hondigagae.global.properties;

/**
 * LLM 제공자. Spring AI 의 provider 모듈을 갈아 끼우는 스위치다.
 *
 * <p>어댑터와 모델 빈이 이 값으로 조건 분기하므로, 새 제공자를 붙일 때는
 * spring-ai-{provider} 의존과 모델 빈·어댑터를 더하고 여기 값을 추가한다.
 * application 계층은 {@code AiLlmPort} 만 알기 때문에 손댈 것이 없다.
 */
public enum AiLlmProvider {

    OLLAMA,
    ANTHROPIC
}
