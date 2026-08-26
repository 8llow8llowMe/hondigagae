package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 식약처 반려동물 동반출입 음식점 현황 설정.
 *
 * <p>인증키가 없다. 식품안전나라 화면의 엑셀 내려받기 경로에 POST 하면 xlsx 가 그대로 온다.
 *
 * <p><b>주의</b>: 공개된 오픈 API 가 아니라 화면이 쓰는 경로다. 규격이 바뀌면 끊길 수 있어
 * {@code filePath} 로 내려받아 둔 파일을 대신 읽는 길을 열어 둔다 — 그 경로에 파일이 있으면
 * 내려받기를 건너뛴다.
 */
@ConfigurationProperties(prefix = "mfds.pet-restaurant")
public record MfdsPetRestaurantProperties(
    String baseUrl,
    String downloadPath,
    String filePath,
    int connectTimeoutMs,
    int readTimeoutMs
) {

    public MfdsPetRestaurantProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://www.foodsafetykorea.go.kr";
        }
        if (downloadPath == null || downloadPath.isBlank()) {
            downloadPath = "/portal/petKorea/downloadExcel.do";
        }
        if (connectTimeoutMs <= 0) {
            connectTimeoutMs = 3_000;
        }
        if (readTimeoutMs <= 0) {
            readTimeoutMs = 30_000;
        }
    }
}
