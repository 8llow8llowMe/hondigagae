package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * LLM provider 접속/생성 설정.
 *
 * <p>{@code enabled} 가 false 면 {@code StubLlmAdapter} 가 뜬다. 키 없이도 비동기 파이프라인
 * (제출-폴링-완료)을 끝까지 돌려 볼 수 있어야 하기 때문이다 - 프론트 개발과 CI 가 API 키에
 * 묶이면 안 된다.
 *
 * <p>API 키는 코드/yml 에 평문으로 커밋하지 않는다. 환경변수 또는 Jasypt 로 관리한다
 * (external-api-guide §4).
 */
@ConfigurationProperties(prefix = "ai-llm")
public record AiLlmProperties(
    boolean enabled,
    String apiKey,
    String model,
    Integer maxTokens,
    // 후보 장소를 몇 개까지 프롬프트에 실을지. 토큰 비용과 선택지 다양성의 절충이다.
    Integer placeCandidateSize,
    // SDK 클라이언트 타임아웃(초). 외부 호출은 타임아웃을 반드시 명시한다 (coding-conventions §10).
    Integer timeoutSeconds
) {

    /**
     * 기본 모델. 프로퍼티로 바꿀 수 있게 두되 기본값은 코드에 남긴다 - 설정이 비었을 때
     * 조용히 다른 모델로 떨어지는 것보다 낫다.
     */
    private static final String DEFAULT_MODEL = "claude-opus-5";

    public AiLlmProperties {
        if (model == null || model.isBlank()) {
            model = DEFAULT_MODEL;
        }
        if (maxTokens == null || maxTokens <= 0) {
            // 비스트리밍 요청이라 SDK HTTP 타임아웃 안에 들어오는 범위로 잡는다.
            maxTokens = 16_000;
        }
        if (placeCandidateSize == null || placeCandidateSize <= 0) {
            placeCandidateSize = 50;
        }
        if (timeoutSeconds == null || timeoutSeconds <= 0) {
            timeoutSeconds = 180;
        }
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
