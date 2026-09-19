package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceDelistCommandPort;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Component;

/**
 * place delisting.
 *
 * <p>병합된 행(merged_into_id 있음)도 대상이다 — 원천에서 빠졌으면 흡수됐든 아니든 stale 이다.
 * 반대로 재등장한 행은 각 upsert 의 UPDATE 절이 delisted_at = NULL 로 되살린다.
 *
 * <p><b>범위는 (source, area_code, content_type_id) 다.</b> 적재가 지역 단위로 도는데 delist 를
 * source 전체로 걸면, 다른 지역으로 한 번 실행하는 순간 기존 지역의 행 전부가 "이번에 안 건드린
 * 행"으로 보여 통째로 내려간다. <b>적재는 콘텐츠 타입 단위로도 돈다</b> — 그래서 타입도 같은
 * 규칙을 받는다 (#726). 한 타입이 0건으로 들어온 실행이 그 타입의 행 전부를 내리던 구멍은,
 * 지역에 대해 이미 막아 둔 것과 같은 모양의 비대칭이었다.
 *
 * <p>{@code contentTypeIds} 가 {@code null} 이면 타입으로 자르지 않는다 — 문화정보원·식약처처럼
 * 한 번의 실행이 그 원천 전체를 덮는 경우다. 빈 컬렉션은 {@code IN ()} 이 되어 SQL 자체가
 * 깨지므로 거부한다. "적재된 타입이 하나도 없다"는 delist 를 <b>돌리지 않을</b> 이유이지
 * 빈 범위로 돌릴 이유가 아니다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceDelistAdapter implements PlaceDelistCommandPort {

    private static final String COUNT_ACTIVE_SQL = """
        SELECT COUNT(*)
          FROM place
         WHERE source = ?
           AND area_code = ?
           AND delisted_at IS NULL""";

    private static final String COUNT_ACTIVE_BY_CONTENT_TYPE_SQL = """
        SELECT content_type_id, COUNT(*)
          FROM place
         WHERE source = ?
           AND area_code = ?
           AND delisted_at IS NULL""";

    private static final String GROUP_BY_CONTENT_TYPE = "\n GROUP BY content_type_id";

    private static final String DELIST_STALE_SQL = """
        UPDATE place
           SET delisted_at = NOW(),
               updated_at = NOW()
         WHERE source = ?
           AND area_code = ?
           AND synced_at < ?
           AND delisted_at IS NULL""";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public long countActive(String source, String areaCode, Collection<String> contentTypeIds) {
        Long count = jdbcTemplate.queryForObject(
            COUNT_ACTIVE_SQL + contentTypeFilter(contentTypeIds), Long.class,
            arguments(contentTypeIds, source, areaCode));
        return count == null ? 0 : count;
    }

    @Override
    public Map<String, Long> countActiveByContentType(String source, String areaCode, Collection<String> contentTypeIds) {
        String sql = COUNT_ACTIVE_BY_CONTENT_TYPE_SQL + contentTypeFilter(contentTypeIds) + GROUP_BY_CONTENT_TYPE;
        Map<String, Long> activeByContentType = new LinkedHashMap<>();
        RowCallbackHandler rowCallbackHandler = resultSet -> {
            // content_type_id 가 NULL 인 행은 타입 범위 판정에 쓸 수 없으므로 버린다.
            String contentTypeId = resultSet.getString(1);
            if (contentTypeId != null) {
                activeByContentType.put(contentTypeId, resultSet.getLong(2));
            }
        };
        jdbcTemplate.query(sql, rowCallbackHandler, arguments(contentTypeIds, source, areaCode));
        return activeByContentType;
    }

    @Override
    public int delistStale(String source, String areaCode, Collection<String> contentTypeIds, LocalDateTime runStartedAt) {
        // 타입 필터를 맨 뒤에 붙여 앞선 세 파라미터의 순서를 고정한다.
        return jdbcTemplate.update(DELIST_STALE_SQL + contentTypeFilter(contentTypeIds),
            arguments(contentTypeIds, source, areaCode, Timestamp.valueOf(runStartedAt)));
    }

    /** 타입 수가 최대 7개(DEFAULT_IMPORT_TARGETS)로 고정이라 동적 플레이스홀더로 충분하다. */
    private String contentTypeFilter(Collection<String> contentTypeIds) {
        if (contentTypeIds == null) {
            return "";
        }
        if (contentTypeIds.isEmpty()) {
            throw new IllegalArgumentException(
                "contentTypeIds must not be empty. pass null to skip the content type scope");
        }
        return "\n   AND content_type_id IN (%s)".formatted(
            String.join(", ", Collections.nCopies(contentTypeIds.size(), "?")));
    }

    private Object[] arguments(Collection<String> contentTypeIds, Object... leadingArguments) {
        if (contentTypeIds == null) {
            return leadingArguments;
        }
        return Stream.concat(Stream.of(leadingArguments), List.copyOf(contentTypeIds).stream()).toArray();
    }
}
