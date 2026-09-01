package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceDelistCommandPort;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * place delisting.
 *
 * <p>병합된 행(merged_into_id 있음)도 대상이다 — 원천에서 빠졌으면 흡수됐든 아니든 stale 이다.
 * 반대로 재등장한 행은 각 upsert 의 UPDATE 절이 delisted_at = NULL 로 되살린다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceDelistAdapter implements PlaceDelistCommandPort {

    private static final String COUNT_ACTIVE_SQL = """
        SELECT COUNT(*) FROM place WHERE source = ? AND delisted_at IS NULL
        """;

    private static final String DELIST_STALE_SQL = """
        UPDATE place
           SET delisted_at = NOW(),
               updated_at = NOW()
         WHERE source = ?
           AND synced_at < ?
           AND delisted_at IS NULL
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public long countActive(String source) {
        Long count = jdbcTemplate.queryForObject(COUNT_ACTIVE_SQL, Long.class, source);
        return count == null ? 0 : count;
    }

    @Override
    public int delistStale(String source, LocalDateTime runStartedAt) {
        return jdbcTemplate.update(DELIST_STALE_SQL, source, Timestamp.valueOf(runStartedAt));
    }
}
