package com.hondigagae.domainlayer.congestionimport.domain.model;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import lombok.Builder;

/**
 * 원천 명칭과 장소를 이은 결과 한 행.
 *
 * <p>{@code placeId} 가 null 이고 {@code matchType} 이 UNMATCHED 인 행도 <b>저장한다.</b>
 * 매칭 실패를 행 없이 버리면 커버리지가 얼마인지 아무도 모르게 되고, 나중에 수동으로
 * 보정할 대상 목록도 사라진다.
 */
@Builder
public record ResolvedPlaceNameLink(
    String sourceType,
    String areaCd,
    String signguCd,
    String tatsNm,
    Long placeId,
    String matchType
) {

    private static final long HASH_ID_BASE = 1L << 59;
    private static final long HASH_ID_RANGE = 1L << 58;

    public long id() {
        String seed = sourceType + "|" + areaCd + "|" + signguCd + "|" + tatsNm;
        return HASH_ID_BASE + Math.floorMod(hash(seed), HASH_ID_RANGE);
    }

    public boolean isMatched() {
        return placeId != null;
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
