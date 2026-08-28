package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 기상청 예보 API 접속 설정과 캐시 정책.
 *
 * <p>serviceKey 는 공공데이터포털의 "디코딩(원문)" 키를 그대로 넣는다. URL 인코딩은 어댑터가
 * 수행하므로 인코딩된 키를 넣으면 이중 인코딩으로 인증에 실패한다 (TourApiProperties 와 동일).
 * 관광공사(B551011) 키와 <b>같은 키를 쓸 수 있음이 실호출로 확인</b>되어 있다
 * (data-api-analysis.md §8).
 *
 * <p>단기예보와 중기예보는 <b>base-url 이 다르고 발표 주기도 다르다</b>(8회/일 vs 2회/일).
 * 키만 공유하므로 나머지는 따로 둔다.
 *
 * <h2>쿼터 지렛대</h2>
 *
 * 개발계정은 일 1,000건이다. 실측 기준 제주 육지를 덮는 격자가 94개이고 단기예보 발표가
 * 하루 8회이므로, 전 격자를 매 회차 조회해도 752건으로 한도 안에 들어온다. 다만 마진이
 * 25% 뿐이라 아래 셋을 조절 가능한 값으로 빼 두었다.
 *
 * <ul>
 *   <li>{@code cacheGraceMinutes} — 발표 후에도 이전 값을 쓸 시간. 늘리면 호출이 준다</li>
 *   <li>{@code gridCoarsenFactor} — 인접 격자를 묶어 캐시 키를 줄인다. <b>정확도를 내주는
 *       거래</b>라 기본은 1(끔)이다</li>
 *   <li>{@code refreshLockSeconds} — 발표 직후 동시 요청이 같은 격자를 여러 번 부르는 것을 막는다</li>
 * </ul>
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
    // 단기예보 한 번에 받아올 행 수.
    // 실측(2026-08-28, 제주 격자 53:38): 회차마다 907~1052행이라 1000 으로는 잘린다.
    // 잘리면 오류가 아니라 마지막 날이 반쪽으로 와서 최고기온이 낮게 나온다. 여유를 둔다.
    Integer numOfRows,
    // 캐시가 만료됐고 원천도 실패했을 때 허용할 스테일 캐시 수명(초). 기본 6시간.
    Integer staleCacheSeconds,
    // 중기예보는 발표 간격이 길어 스테일 허용도 길게 잡는다. 기본 36시간.
    Integer midTermStaleCacheSeconds,
    // 발표 이후에도 이전 회차 값을 계속 쓸 시간(분). 쿼터를 아끼는 지렛대다.
    Integer cacheGraceMinutes,
    Integer midTermCacheGraceMinutes,
    // 캐시 키로 쓸 격자를 몇 칸씩 묶을지. 1 이면 묶지 않는다.
    Integer gridCoarsenFactor,
    // 원천 갱신 락 수명(초). 락을 잡은 요청이 죽어도 이 시간 뒤 자동으로 풀린다.
    Integer refreshLockSeconds
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
            numOfRows = 1500;
        }
        if (staleCacheSeconds == null || staleCacheSeconds <= 0) {
            staleCacheSeconds = 21_600;
        }
        if (midTermStaleCacheSeconds == null || midTermStaleCacheSeconds <= 0) {
            midTermStaleCacheSeconds = 129_600;
        }
        if (cacheGraceMinutes == null || cacheGraceMinutes < 0) {
            cacheGraceMinutes = 30;
        }
        if (midTermCacheGraceMinutes == null || midTermCacheGraceMinutes < 0) {
            midTermCacheGraceMinutes = 60;
        }
        if (gridCoarsenFactor == null || gridCoarsenFactor < 1) {
            gridCoarsenFactor = 1;
        }
        if (refreshLockSeconds == null || refreshLockSeconds <= 0) {
            refreshLockSeconds = 10;
        }
    }
}
