package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * place PK 생성기.
 *
 * <p>batch-service 는 persistence-core(Snowflake)에 의존하지 않으므로 원천 식별자에서
 * <b>결정적으로</b> id 를 만든다. 같은 원천 행은 몇 번을 재실행해도 같은 id 가 나와 upsert 가 멱등해진다.
 *
 * <ul>
 *   <li>TourAPI — contentId 를 그대로 쓴다. 전역 유일하고 사람이 읽기 쉽다.</li>
 *   <li>그 외 원천 — {@code SHA-256(source|sourceKey)} 상위 비트를 접어 쓴다.
 *       TourAPI contentId 대역(최대 10자리 남짓)과 절대 겹치지 않도록 항상 2^62 이상으로 만든다.</li>
 * </ul>
 */
public final class PlaceIdFactory {

    /** 해시 기반 id 의 하한. 이 값 아래는 TourAPI contentId 대역이라 침범하지 않는다. */
    private static final long HASH_ID_BASE = 1L << 62;
    private static final long HASH_ID_RANGE = 1L << 61;

    private PlaceIdFactory() {
    }

    public static long create(PlaceSourceType source, String sourceKey) {
        if (source == PlaceSourceType.TOUR_API) {
            return Long.parseLong(sourceKey);
        }
        return HASH_ID_BASE + Math.floorMod(hash(source.name() + "|" + sourceKey), HASH_ID_RANGE);
    }

    /**
     * 원천에 안정적인 식별자가 없을 때 쓰는 sourceKey. 시설명과 주소 조합을 해시해 32자로 줄인다.
     * 시설명만으로는 지점이 여럿인 프랜차이즈가 한 행으로 뭉개진다.
     */
    public static String sourceKeyOf(String name, String address) {
        String seed = normalize(name) + "|" + normalize(address);
        return toHex(digest(seed)).substring(0, 32);
    }

    private static long hash(String seed) {
        byte[] digest = digest(seed);
        long value = 0L;
        for (int i = 0; i < 8; i++) {
            value = (value << 8) | (digest[i] & 0xFF);
        }
        return value;
    }

    private static byte[] digest(String seed) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(seed.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.PLACE_ID_GENERATION_FAILED, exception);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            builder.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
        }
        return builder.toString();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }
}
