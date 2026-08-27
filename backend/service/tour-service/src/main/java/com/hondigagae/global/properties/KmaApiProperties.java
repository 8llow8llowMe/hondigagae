package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 기상청 예보 API 접속 설정.
 *
 * <p>serviceKey 는 공공데이터포털의 "디코딩(원문)" 키를 그대로 넣는다. URL 인코딩은 어댑터가
 * 수행하므로 인코딩된 키를 넣으면 이중 인코딩으로 인증에 실패한다 (TourApiProperties 와 동일).
 * 관광공사(B551011) 키와 <b>같은 키를 쓸 수 있음이 실호출로 확인</b>되어 있다
 * (data-api-analysis.md §8).
 *
 * <p>단기예보와 중기예보는 <b>base-url 이 다르고 발표 주기도 다르다</b>(8회/일 vs 2회/일).
 * 키만 공유하므로 나머지는 따로 둔다.
 */
@ConfigurationProperties(prefix = "kma-api")
public record KmaApiProperties(
    // 단기예보 (VilageFcstInfoService_2.0) — 격자 기반, 오늘 포함 약 5일
    String baseUrl,
    // 중기예보 (MidFcstInfoService) — 예보구역 기반, D+3 ~ D+10
    String midTermBaseUrl,
    String serviceKey,
    // 발표시각 이후 데이터가 실제로 제공되기까지의 여유(분). 기상청 공지는 약 10분이지만
    // 회차 직후에는 일부 category 가 비어 오는 일이 있어 어댑터가 직전 회차로 한 번 더 폴백한다.
    Integer publishDelayMinutes,
    // 중기예보는 1일 2회(06, 18시)라 회차 간격이 12시간이다. 여유를 조금 더 준다.
    Integer midTermPublishDelayMinutes,
    // 단기예보 한 번에 받아올 행 수. 한 회차의 5일치 전 category 를 받으려면 넉넉해야 한다.
    Integer numOfRows,
    // 캐시가 만료됐고 원천도 실패했을 때 허용할 스테일 캐시 수명(초). 기본 6시간.
    Integer staleCacheSeconds,
    // 중기예보는 발표 간격이 길어 스테일 허용도 길게 잡는다. 기본 36시간.
    Integer midTermStaleCacheSeconds
) {

    /**
     * 기본 모델. 프로퍼티로 바꿀 수 있게 두되 기본값은 코드에 남긴다 -
     * 설정이 비었을 때 조용히 다른 엔드포인트로 떨어지는 것보다 낫다.
     */
    private static final String DEFAULT_BASE_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
    private static final String DEFAULT_MID_TERM_BASE_URL = "https://apis.data.go.kr/1360000/MidFcstInfoService";

    public KmaApiProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = DEFAULT_BASE_URL;
        }
        if (midTermBaseUrl == null || midTermBaseUrl.isBlank()) {
            midTermBaseUrl = DEFAULT_MID_TERM_BASE_URL;
        }
        if (publishDelayMinutes == null || publishDelayMinutes < 0) {
            publishDelayMinutes = 10;
        }
        if (midTermPublishDelayMinutes == null || midTermPublishDelayMinutes < 0) {
            midTermPublishDelayMinutes = 20;
        }
        if (numOfRows == null || numOfRows <= 0) {
            numOfRows = 1000;
        }
        if (staleCacheSeconds == null || staleCacheSeconds <= 0) {
            staleCacheSeconds = 21_600;
        }
        if (midTermStaleCacheSeconds == null || midTermStaleCacheSeconds <= 0) {
            midTermStaleCacheSeconds = 129_600;
        }
    }
}
