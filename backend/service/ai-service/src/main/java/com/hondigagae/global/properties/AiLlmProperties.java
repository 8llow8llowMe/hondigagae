package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * LLM provider 접속/생성 설정.
 *
 * <p>{@code enabled} 가 false 면 {@code StubLlmAdapter} 가 뜬다. LLM 없이도 비동기 파이프라인
 * (제출-폴링-완료)을 끝까지 돌려 볼 수 있어야 하기 때문이다 — 프론트 개발과 CI 가 로컬 LLM
 * 기동 여부에 묶이면 안 된다.
 *
 * <p>provider 는 Spring AI 모듈 스위치다({@link AiLlmProvider}). 기본은 공유 인프라의
 * Ollama(로컬 LLM)이고, 모델 교체는 {@code model} 값만 바꾸면 된다 — 어댑터는
 * {@code AiLlmPort} 뒤에 있어 application 계층에 provider 가 드러나지 않는다.
 */
@ConfigurationProperties(prefix = "ai-llm")
public record AiLlmProperties(
    boolean enabled,
    AiLlmProvider provider,
    String baseUrl,
    // Ollama 는 키가 없다. 키가 필요한 provider 를 붙일 때를 위해 자리만 둔다.
    String apiKey,
    String model,
    // 모델 호출 read timeout(ms). 외부 호출은 타임아웃을 반드시 명시한다 (coding-conventions §10).
    Long timeoutMs,
    Integer maxTokens,
    Double temperature,
    // gpt-oss 계열 추론 강도(low/medium/high). 기본 medium 은 추론에 생성 토큰 대부분을
    // 소모하므로 low 를 기본값으로 쓴다. 미지원 모델은 이 값을 무시한다.
    String reasoningEffort,
    // 후보 장소를 몇 개까지 프롬프트에 실을지. 토큰 비용과 선택지 다양성의 절충이다.
    Integer placeCandidateSize
) {

    public AiLlmProperties {
        if (provider == null) {
            provider = AiLlmProvider.OLLAMA;
        }
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://localhost:11434";
        }
        if (model == null || model.isBlank()) {
            // 8GB UMA 안에 들어가는 로컬 기본. 설정이 비었을 때 조용히 다른 모델로
            // 떨어지는 것보다 기본값이 코드에 보이는 편이 낫다.
            model = "qwen2.5:7b-instruct";
        }
        if (timeoutMs == null || timeoutMs <= 0) {
            // 일정 생성은 리포트보다 출력이 길다. 로컬 LLM 기준 여유를 둔다.
            timeoutMs = 120_000L;
        }
        if (maxTokens == null || maxTokens <= 0) {
            maxTokens = 4_000;
        }
        if (temperature == null) {
            temperature = 0.2;
        }
        if (reasoningEffort == null || reasoningEffort.isBlank()) {
            reasoningEffort = "low";
        }
        if (placeCandidateSize == null || placeCandidateSize <= 0) {
            placeCandidateSize = 50;
        }
    }
}
