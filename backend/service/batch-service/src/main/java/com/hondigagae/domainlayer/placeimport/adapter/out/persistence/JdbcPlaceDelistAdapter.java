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
 *
 * <p><b>범위는 (source, area_code) 다.</b> 적재가 지역 단위로 도는데 delist 를 source 전체로
 * 걸면, 다른 지역으로 한 번 실행하는 순간 기존 지역의 행 전부가 "이번에 안 건드린 행"으로
 * 보여 통째로 내려간다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceDelistAdapter implements PlaceDelistCommandPort {

    private static final String COUNT_ACTIVE_SQL = """
        SELECT COUNT(*) FROM place WHERE source = ? AND area_code = ? AND delisted_at IS NULL
        """;

    private static final String DELIST_STALE_SQL = """
        UPDATE place
           SET delisted_at = NOW(),
               updated_at = NOW()
         WHERE source = ?
           AND area_code = ?
           AND synced_at < ?
           AND delisted_at IS NULL
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public long countActive(String source, String areaCode) {
        Long count = jdbcTemplate.queryForObject(COUNT_ACTIVE_SQL, Long.class, source, areaCode);
        return count == null ? 0 : count;
    }

    @Override
    public int delistStale(String source, String areaCode, LocalDateTime runStartedAt) {
        return jdbcTemplate.update(DELIST_STALE_SQL, source, areaCode, Timestamp.valueOf(runStartedAt));
    }
}
