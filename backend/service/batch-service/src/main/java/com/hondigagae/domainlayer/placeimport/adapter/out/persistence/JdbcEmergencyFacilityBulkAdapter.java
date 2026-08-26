package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.EmergencyFacilityBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedEmergencyFacility;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * emergency_facility 대량 upsert.
 *
 * <p>테이블 스키마의 원천은 tour-service 의 EmergencyFacilityEntity(JPA)다.
 *
 * <p>CSV 에 이름·주소·좌표가 똑같은 중복이 많은데 source_key(시설명+주소 해시)가 UK 라
 * 별도 처리 없이 정리된다 — 제주 841행이 214곳이 된다.
 */
@Component
@RequiredArgsConstructor
public class JdbcEmergencyFacilityBulkAdapter implements EmergencyFacilityBulkPort {

    private static final int BATCH_SIZE = 500;

    private static final String UPSERT_SQL = """
        INSERT INTO emergency_facility (
            id,
            source_key,
            facility_type,
            name,
            addr,
            sigungu_code,
            lat,
            lng,
            tel,
            operating_hours,
            rest_date,
            open24,
            source_modified_at,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            facility_type = VALUES(facility_type),
            name = VALUES(name),
            addr = VALUES(addr),
            sigungu_code = VALUES(sigungu_code),
            lat = VALUES(lat),
            lng = VALUES(lng),
            tel = VALUES(tel),
            operating_hours = VALUES(operating_hours),
            rest_date = VALUES(rest_date),
            open24 = VALUES(open24),
            source_modified_at = VALUES(source_modified_at),
            synced_at = VALUES(synced_at),
            updated_at = NOW()
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void upsertAll(List<ImportedEmergencyFacility> facilitys) {
        LocalDateTime syncedAt = LocalDateTime.now();

        for (int start = 0; start < facilitys.size(); start += BATCH_SIZE) {
            int end = Math.min(start + BATCH_SIZE, facilitys.size());
            List<ImportedEmergencyFacility> chunk = facilitys.subList(start, end);

            jdbcTemplate.batchUpdate(UPSERT_SQL, new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int i) throws SQLException {
                    ImportedEmergencyFacility facility = chunk.get(i);
                    int index = 1;
                    ps.setLong(index++, facility.facilityId());
                    ps.setString(index++, facility.sourceKey());
                    ps.setString(index++, facility.facilityType().name());
                    ps.setString(index++, facility.name());
                    ps.setString(index++, facility.addr());
                    ps.setString(index++, facility.sigunguCode());
                    setNullableDecimal(ps, index++, facility.lat());
                    setNullableDecimal(ps, index++, facility.lng());
                    ps.setString(index++, facility.tel());
                    ps.setString(index++, facility.operatingHours());
                    ps.setString(index++, facility.restDate());
                    ps.setBoolean(index++, facility.open24());
                    setNullableDateTime(ps, index++, facility.sourceModifiedAt());
                    ps.setTimestamp(index, Timestamp.valueOf(syncedAt));
                }

                @Override
                public int getBatchSize() {
                    return chunk.size();
                }
            });
        }
    }

    private void setNullableDecimal(PreparedStatement ps, int index, java.math.BigDecimal value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.DECIMAL);
            return;
        }
        ps.setBigDecimal(index, value);
    }

    private void setNullableDateTime(PreparedStatement ps, int index, LocalDateTime value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.TIMESTAMP);
            return;
        }
        ps.setTimestamp(index, Timestamp.valueOf(value));
    }
}
