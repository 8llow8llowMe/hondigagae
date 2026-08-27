package com.hondigagae.domainlayer.congestionimport.domain.model;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import lombok.Builder;

/**
 * 적재할 집중률 예측 한 행.
 *
 * <p>id 를 원천 키에서 <b>결정적으로</b> 만든다. batch-service 는 Snowflake 에 의존하지 않고,
 * 같은 행을 몇 번 재실행해도 같은 id 가 나와야 upsert 가 멱등해지기 때문이다
 * ({@code PlaceIdFactory} 와 같은 이유, 같은 방식).
 */
@Builder
public record ImportedCongestionForecast(
    String baseYmd,
    String areaCd,
    String signguCd,
    String tatsNm,
    double cnctrRate
) {

    /** 해시 id 대역. place 계열과 겹칠 일이 없도록 별도 대역을 쓴다. */
    private static final long HASH_ID_BASE = 1L << 60;
    private static final long HASH_ID_RANGE = 1L << 59;

    public long id() {
        String seed = baseYmd + "|" + areaCd + "|" + signguCd + "|" + tatsNm;
        return HASH_ID_BASE + Math.floorMod(hash(seed), HASH_ID_RANGE);
    }

    private static long hash(String seed) {
        byte[] digest;
        try {
            digest = MessageDigest.getInstance("SHA-256").digest(seed.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 not available", exception);
        }
        long value = 0L;
        for (int index = 0; index < 8; index++) {
            value = (value << 8) | (digest[index] & 0xFF);
        }
        return value;
    }
}
