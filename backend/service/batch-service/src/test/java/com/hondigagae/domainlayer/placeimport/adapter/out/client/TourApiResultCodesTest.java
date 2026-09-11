package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 일일 한도 초과 판별.
 *
 * <p>이 판별이 틀리면 한도 초과가 "이 장소만 실패"로 접혀, 적재 스텝이 남은 대상 전부를
 * 실패로 기록하며 헛돈다. 그때 밀린 {@code synced_at} 때문에 다음 실행도 그 장소들을 건너뛴다.
 */
class TourApiResultCodesTest {

    @Test
    @DisplayName("한도 초과 코드는 자리수 표기가 달라도 잡는다")
    void detectsQuotaCodeInBothSpellings() {
        assertThat(TourApiResultCodes.quotaExceeded("22", "")).isTrue();
        assertThat(TourApiResultCodes.quotaExceeded("0022", "")).isTrue();
        assertThat(TourApiResultCodes.quotaExceeded(" 22 ", null)).isTrue();
    }

    @Test
    @DisplayName("코드가 비고 메시지만 오는 응답도 잡는다")
    void detectsQuotaByMessage() {
        assertThat(TourApiResultCodes.quotaExceeded("", "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"))
            .isTrue();
    }

    @Test
    @DisplayName("다른 오류는 한도 초과로 보지 않는다 — 그것들은 한 곳 실패로 넘겨야 한다")
    void otherFailuresAreNotQuota() {
        assertThat(TourApiResultCodes.quotaExceeded("30", "SERVICE_KEY_IS_NOT_REGISTERED_ERROR")).isFalse();
        assertThat(TourApiResultCodes.quotaExceeded("10", "INVALID_REQUEST_PARAMETER_ERROR")).isFalse();
        assertThat(TourApiResultCodes.quotaExceeded(null, null)).isFalse();
    }
}
