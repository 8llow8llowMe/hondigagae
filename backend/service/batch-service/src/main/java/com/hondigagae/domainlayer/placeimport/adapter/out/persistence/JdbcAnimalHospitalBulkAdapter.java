package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.AnimalHospitalBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedAnimalHospital;
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
 * animal_hospital 대량 upsert.
 *
 * <p>테이블 스키마의 원천은 tour-service 의 AnimalHospitalEntity(JPA)다.
 *
 * <p>CSV 에 이름·주소·좌표가 똑같은 중복이 139건 있는데, source_key(이름+주소 해시)가 UK 라
 * 별도 처리 없이 실제 86곳으로 정리된다.
 */
@Component
@RequiredArgsConstructor
public class JdbcAnimalHospitalBulkAdapter implements AnimalHospitalBulkPort {

    private static final int BATCH_SIZE = 500;

    private static final String UPSERT_SQL = """
        INSERT INTO animal_hospital (
            id,
            source_key,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
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
    public void upsertAll(List<ImportedAnimalHospital> hospitals) {
        LocalDateTime syncedAt = LocalDateTime.now();

        for (int start = 0; start < hospitals.size(); start += BATCH_SIZE) {
            int end = Math.min(start + BATCH_SIZE, hospitals.size());
            List<ImportedAnimalHospital> chunk = hospitals.subList(start, end);

            jdbcTemplate.batchUpdate(UPSERT_SQL, new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int i) throws SQLException {
                    ImportedAnimalHospital hospital = chunk.get(i);
                    int index = 1;
                    ps.setLong(index++, hospital.hospitalId());
                    ps.setString(index++, hospital.sourceKey());
                    ps.setString(index++, hospital.name());
                    ps.setString(index++, hospital.addr());
                    ps.setString(index++, hospital.sigunguCode());
                    setNullableDecimal(ps, index++, hospital.lat());
                    setNullableDecimal(ps, index++, hospital.lng());
                    ps.setString(index++, hospital.tel());
                    ps.setString(index++, hospital.operatingHours());
                    ps.setString(index++, hospital.restDate());
                    ps.setBoolean(index++, hospital.open24());
                    setNullableDateTime(ps, index++, hospital.sourceModifiedAt());
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
