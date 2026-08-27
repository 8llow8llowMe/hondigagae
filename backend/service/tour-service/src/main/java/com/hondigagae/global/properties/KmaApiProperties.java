package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 기상청 단기예보(VilageFcstInfoService_2.0) 접속 설정.
 *
 * <p>serviceKey 는 공공데이터포털의 "디코딩(원문)" 키를 그대로 넣는다. URL 인코딩은 어댑터가
 * 수행하므로 인코딩된 키를 넣으면 이중 인코딩으로 인증에 실패한다 (TourApiProperties 와 동일).
 * 관광공사(B551011) 키와 <b>같은 키를 쓸 수 있음이 실호출로 확인</b>되어 있다
 * (data-api-analysis.md §8).
 */
@ConfigurationProperties(prefix = "kma-api")
public record KmaApiProperties(
    String baseUrl,
    String serviceKey,
    // 발표시각 이후 데이터가 실제로 제공되기까지의 여유(분). 기상청 공지는 약 10분이지만
    // 회차 직후에는 일부 category 가 비어 오는 일이 있어 어댑터가 직전 회차로 한 번 더 폴백한다.
    Integer publishDelayMinutes,
    // 한 번에 받아올 행 수. 한 발표 회차의 3일치 전 category 를 한 번에 받으려면 넉넉해야 한다.
    Integer numOfRows,
    // 캐시가 만료됐고 원천도 실패했을 때 허용할 스테일 캐시 수명(초). 기본 6시간.
    Integer staleCacheSeconds
) {

    public KmaApiProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
        }
        if (publishDelayMinutes == null || publishDelayMinutes < 0) {
            publishDelayMinutes = 10;
        }
        if (numOfRows == null || numOfRows <= 0) {
            numOfRows = 1000;
        }
        if (staleCacheSeconds == null || staleCacheSeconds <= 0) {
            staleCacheSeconds = 21_600;
        }
    }
}
