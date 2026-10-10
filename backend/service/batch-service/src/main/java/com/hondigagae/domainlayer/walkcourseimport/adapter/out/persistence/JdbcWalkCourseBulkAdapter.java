package com.hondigagae.domainlayer.walkcourseimport.adapter.out.persistence;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.WalkCourseBulkPort;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * walk_course 대량 upsert 어댑터.
 *
 * <p>테이블 스키마의 원천은 tour-service 의 WalkCourseEntity(JPA)다 — 이 배치는 스키마를
 * 만들지 않고 upsert 만 수행하므로, 로컬에서는 tour-service 를 먼저 한 번 기동해 테이블을
 * 생성해야 한다 (place 와 같은 소유 구조).
 *
 * <p><b>id 전략</b>: {@code OlleCourseParser.walkCourseId} 가 코스키에서 결정적으로 만든다.
 * 재실행해도 같은 행에 꽂힌다.
 */
@Component
@RequiredArgsConstructor
public class JdbcWalkCourseBulkAdapter implements WalkCourseBulkPort {

    private static final String UPSERT_SQL = """
        INSERT INTO walk_course (
            id,
            course_key,
            course_no,
            variant,
            course_order,
            name,
            distance_km,
            duration_text,
            duration_max_minutes,
            start_end_point,
            start_point_name,
            end_point_name,
            lat,
            lng,
            end_lat,
            end_lng,
            content_id,
            first_image,
            base_date,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            course_no = VALUES(course_no),
            variant = VALUES(variant),
            course_order = VALUES(course_order),
            name = VALUES(name),
            distance_km = VALUES(distance_km),
            duration_text = VALUES(duration_text),
            duration_max_minutes = VALUES(duration_max_minutes),
            start_end_point = VALUES(start_end_point),
            start_point_name = VALUES(start_point_name),
            end_point_name = VALUES(end_point_name),
            lat = VALUES(lat),
            lng = VALUES(lng),
            end_lat = VALUES(end_lat),
            end_lng = VALUES(end_lng),
            content_id = VALUES(content_id),
            first_image = VALUES(first_image),
            base_date = VALUES(base_date),
            synced_at = NOW(),
            updated_at = NOW()
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public int upsertAll(List<ImportedWalkCourse> courses) {
        if (courses.isEmpty()) {
            return 0;
        }
        jdbcTemplate.batchUpdate(UPSERT_SQL, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int index) throws SQLException {
                ImportedWalkCourse course = courses.get(index);
                ps.setLong(1, course.id());
                ps.setString(2, course.courseKey());
                ps.setString(3, course.courseNo());
                setNullableString(ps, 4, course.variant());
                ps.setInt(5, course.courseOrder());
                ps.setString(6, course.name());
                ps.setBigDecimal(7, course.distanceKm());
                ps.setString(8, course.durationText());
                setNullableInt(ps, 9, course.durationMaxMinutes());
                ps.setString(10, course.startEndPoint());
                setNullableString(ps, 11, course.startPointName());
                setNullableString(ps, 12, course.endPointName());
                setNullableDouble(ps, 13, course.lat());
                setNullableDouble(ps, 14, course.lng());
                setNullableDouble(ps, 15, course.endLat());
                setNullableDouble(ps, 16, course.endLng());
                setNullableLong(ps, 17, course.contentId());
                setNullableString(ps, 18, course.firstImage());
                ps.setString(19, course.baseDate());
            }

            @Override
            public int getBatchSize() {
                return courses.size();
            }
        });
        return courses.size();
    }

    private void setNullableString(PreparedStatement ps, int index, String value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.VARCHAR);
        } else {
            ps.setString(index, value);
        }
    }

    private void setNullableInt(PreparedStatement ps, int index, Integer value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.INTEGER);
        } else {
            ps.setInt(index, value);
        }
    }

    private void setNullableLong(PreparedStatement ps, int index, Long value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.BIGINT);
        } else {
            ps.setLong(index, value);
        }
    }

    private void setNullableDouble(PreparedStatement ps, int index, Double value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.DOUBLE);
        } else {
            ps.setDouble(index, value);
        }
    }
}
