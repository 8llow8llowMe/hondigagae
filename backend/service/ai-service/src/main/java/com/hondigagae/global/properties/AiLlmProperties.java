package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * LLM provider 접속/생성 설정.
 *
 * <p>on/off 스위치는 없다. BossPickSeoul 과 같게 LLM 어댑터가 항상 뜨고, Ollama 에 닿지 않으면
 * 기동은 되되 첫 생성 요청이 타임아웃으로 실패한다(Spring AI 는 첫 호출 때 연결한다).
 * 예전에 있던 {@code enabled=false} + 스텁 어댑터는 프론트 개발자가 백엔드를 로컬에 띄우지 않고
 * dev 서버에 직접 붙기로 하면서 제거했다 — 분기 하나가 사라진 만큼 dev 와 로컬이 같은 경로를 탄다.
 *
 * <p>provider 는 Spring AI 모듈 스위치다({@link AiLlmProvider}). 기본은 공유 인프라의
 * Ollama(로컬 LLM)이고, 모델 교체는 {@code model} 값만 바꾸면 된다 — 어댑터는
 * {@code AiLlmPort} 뒤에 있어 application 계층에 provider 가 드러나지 않는다.
 */
@ConfigurationProperties(prefix = "ai-llm")
public record AiLlmProperties(
    AiLlmProvider provider,
    String baseUrl,
    // Ollama 는 키가 없다. 키가 필요한 provider 를 붙일 때를 위해 자리만 둔다.
    String apiKey,
    String model,
    // 모델 호출 read timeout(ms). 외부 호출은 타임아웃을 반드시 명시한다 (coding-conventions §10).
    Long timeoutMs,
    Integer maxTokens,
    // 컨텍스트 창(num_ctx). 프롬프트와 출력이 함께 들어가는 창이다.
    // 명시하지 않으면 Ollama 가 2,048 로 잡고 프롬프트를 조용히 자른다 (#232).
    Integer contextTokens,
    Double temperature,
    // gpt-oss 계열 추론 강도(low/medium/high). 기본 medium 은 추론에 생성 토큰 대부분을
    // 소모하므로 low 를 기본값으로 쓴다. 미지원 모델은 이 값을 무시한다.
    String reasoningEffort,
    // 후보 장소를 몇 개까지 프롬프트에 실을지. 토큰 비용과 선택지 다양성의 절충이다.
    // 프롬프트 크기를 좌우하는 값이라 contextTokens 와 함께 봐야 한다.
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
        if (contextTokens == null || contextTokens <= 0) {
            // 실측(#232): 후보 50곳 기준 일정 프롬프트가 11,160자(시스템 478 + 사용자 7,800 +
            // 출력 스키마 2,882)다. 한글이 3,400자 넘게 섞여 있어 토큰으로는 6,000~8,000 이고,
            // 여기에 maxTokens(출력)까지 같은 창에 들어가므로 16,384 를 기본으로 둔다.
            // 줄이려면 placeCandidateSize 를 함께 줄여야 한다 - 프롬프트의 대부분이 후보 목록이다.
            contextTokens = 16_384;
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
