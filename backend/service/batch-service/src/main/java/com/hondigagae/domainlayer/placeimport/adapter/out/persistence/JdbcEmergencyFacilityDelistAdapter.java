package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.EmergencyFacilityDelistCommandPort;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcEmergencyFacilityDelistAdapter implements EmergencyFacilityDelistCommandPort {

    private static final String COUNT_ACTIVE_SQL = """
        SELECT COUNT(*) FROM emergency_facility WHERE delisted_at IS NULL
        """;

    private static final String DELIST_STALE_SQL = """
        UPDATE emergency_facility
           SET delisted_at = NOW(),
               updated_at = NOW()
         WHERE synced_at < ?
           AND delisted_at IS NULL
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public long countActive() {
        Long count = jdbcTemplate.queryForObject(COUNT_ACTIVE_SQL, Long.class);
        return count == null ? 0 : count;
    }

    @Override
    public int delistStale(LocalDateTime runStartedAt) {
        return jdbcTemplate.update(DELIST_STALE_SQL, Timestamp.valueOf(runStartedAt));
    }
}
