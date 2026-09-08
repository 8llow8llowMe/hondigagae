package com.hondigagae.global.properties;

/**
 * LLM 제공자. Spring AI 의 provider 모듈을 갈아 끼우는 스위치다.
 *
 * <p>어댑터와 모델 빈이 이 값으로 조건 분기하므로, 새 제공자를 붙일 때는
 * spring-ai-{provider} 의존과 모델 빈·어댑터를 더하고 <b>그때</b> 여기 값을 추가한다.
 * application 계층은 {@code AiLlmPort} 만 알기 때문에 손댈 것이 없다.
 *
 * <p>구현이 없는 값을 미리 두지 않는다 — 설정으로 고를 수 있는데 모델 빈이 없으면
 * 어댑터 주입이 실패해 기동 자체가 깨진다.
 */
public enum AiLlmProvider {

    OLLAMA
}
