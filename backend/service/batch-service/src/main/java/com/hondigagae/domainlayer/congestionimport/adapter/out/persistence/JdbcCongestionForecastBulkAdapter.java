package com.hondigagae.domainlayer.congestionimport.adapter.out.persistence;

import com.hondigagae.domainlayer.congestionimport.application.port.out.CongestionForecastBulkPort;
import com.hondigagae.domainlayer.congestionimport.domain.model.ImportedCongestionForecast;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * congestion_forecast 대량 upsert.
 *
 * <p>테이블 스키마의 원천은 tour-service 의 {@code CongestionForecastEntity}(JPA)다.
 * 배치는 JDBC 로 직접 쓰므로 컬럼이 늘면 양쪽을 같이 고쳐야 한다.
 *
 * <p>30일 rolling 원천이라 매일 같은 날짜가 다시 온다. UK(baseYmd, areaCd, signguCd, tatsNm)
 * 기준 upsert 라 예측이 갱신되면 덮어쓴다 - 이것이 의도한 동작이다. 예측은 최신값이 맞다.
 */
@Component
@RequiredArgsConstructor
public class JdbcCongestionForecastBulkAdapter implements CongestionForecastBulkPort {

    private static final int BATCH_SIZE = 500;

    private static final String UPSERT_SQL = """
        INSERT INTO congestion_forecast (
            id, base_ymd, area_cd, signgu_cd, tats_nm, cnctr_rate, synced_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            cnctr_rate = VALUES(cnctr_rate),
            synced_at = VALUES(synced_at),
            updated_at = NOW()
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public int upsertAll(List<ImportedCongestionForecast> forecasts) {
        if (forecasts == null || forecasts.isEmpty()) {
            return 0;
        }
        LocalDateTime syncedAt = LocalDateTime.now();
        int total = 0;

        for (int start = 0; start < forecasts.size(); start += BATCH_SIZE) {
            List<ImportedCongestionForecast> chunk =
                forecasts.subList(start, Math.min(start + BATCH_SIZE, forecasts.size()));
            int[] affected = jdbcTemplate.batchUpdate(UPSERT_SQL, new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement statement, int index) throws SQLException {
                    ImportedCongestionForecast forecast = chunk.get(index);
                    statement.setLong(1, forecast.id());
                    statement.setString(2, forecast.baseYmd());
                    statement.setString(3, forecast.areaCd());
                    statement.setString(4, forecast.signguCd());
                    statement.setString(5, forecast.tatsNm());
                    statement.setDouble(6, forecast.cnctrRate());
                    statement.setTimestamp(7, Timestamp.valueOf(syncedAt));
                }

                @Override
                public int getBatchSize() {
                    return chunk.size();
                }
            });
            total += affected.length;
        }
        return total;
    }
}
