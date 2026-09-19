package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.verifyNoInteractions;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.Invocation;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * delist SQL 의 <b>범위</b> 검증 (#726). SQL 실행에는 실제 MySQL 이 필요해 여기서 못 하지만,
 * 범위를 지탱하는 WHERE 절과 바인딩 순서는 DB 없이도 고정할 수 있다.
 *
 * <p>이 SQL 은 컴파일로 검증되지 않고 고장 나도 조용하다 — {@code content_type_id} 조건 한 줄이
 * 지워지면 잡은 그대로 성공하면서 <b>0건으로 들어온 타입의 행을 전부 내린다.</b> 지역 조건이
 * 지워지면 다른 지역 실행 한 번이 제주 전체를 내린다. 둘 다 로그상으로는 정상이다.
 *
 * <p>동적으로 조립되는 {@code IN (?, ?)} 는 특히 위험하다. 플레이스홀더 수와 바인딩 인자 수가
 * 어긋나면 런타임에야 터지고, 인자 순서가 바뀌면 <b>엉뚱한 범위를 조용히 내린다.</b>
 *
 * <p>인자를 {@code ArgumentCaptor} 대신 호출 기록에서 직접 읽는 이유는 {@code JdbcTemplate}
 * 메서드가 가변인자라서다 — 캡터는 가변인자 한 칸만 잡는다 (다른 어댑터 테스트와 같은 방식).
 */
class JdbcPlaceDelistAdapterTest {

    private static final LocalDateTime RUN_STARTED_AT = LocalDateTime.of(2026, 9, 19, 3, 0);

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final JdbcPlaceDelistAdapter adapter = new JdbcPlaceDelistAdapter(jdbcTemplate);

    @Test
    @DisplayName("타입 범위를 주면 IN 절이 붙고, 인자는 source·areaCode·시각 뒤에 타입 순서대로 온다")
    void delistScopesBySourceAreaAndContentType() {
        adapter.delistStale("TOUR_API", "39", List.of("12", "39"), RUN_STARTED_AT);

        String sql = sqlOf("update");
        assertThat(sql).contains("WHERE source = ?");
        assertThat(sql).contains("AND area_code = ?");
        assertThat(sql).contains("AND synced_at < ?");
        assertThat(sql).contains("AND delisted_at IS NULL");
        // 플레이스홀더 수가 타입 수와 같아야 바인딩이 맞는다
        assertThat(sql).contains("AND content_type_id IN (?, ?)");
        assertThat(boundArguments("update"))
            .containsExactly("TOUR_API", "39", Timestamp.valueOf(RUN_STARTED_AT), "12", "39");
    }

    @Test
    @DisplayName("타입 범위가 null 이면 IN 절을 붙이지 않는다 — 문화정보원·식약처는 원천 전체가 한 실행 범위다")
    void delistOmitsContentTypeFilterWhenScopeIsNull() {
        adapter.delistStale("MFDS", "39", null, RUN_STARTED_AT);

        assertThat(sqlOf("update")).doesNotContain("content_type_id");
        assertThat(boundArguments("update"))
            .containsExactly("MFDS", "39", Timestamp.valueOf(RUN_STARTED_AT));
    }

    @Test
    @DisplayName("빈 타입 목록은 거부한다 — IN () 은 SQL 자체가 깨지고, 그건 '안 돌릴 이유'다")
    void rejectsEmptyContentTypeScope() {
        assertThatThrownBy(() -> adapter.delistStale("TOUR_API", "39", List.of(), RUN_STARTED_AT))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> adapter.countActive("TOUR_API", "39", List.of()))
            .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("활성 건수도 같은 범위로 센다 — 분모와 분자가 어긋나면 급감 가드가 무의미하다")
    void countActiveUsesTheSameScope() {
        adapter.countActive("TOUR_API", "39", List.of("12", "39"));

        String sql = sqlOf("queryForObject");
        assertThat(sql).contains("WHERE source = ?");
        assertThat(sql).contains("AND area_code = ?");
        assertThat(sql).contains("AND delisted_at IS NULL");
        assertThat(sql).contains("AND content_type_id IN (?, ?)");
        // queryForObject 의 두 번째 인자는 결과 타입이라 값 인자는 그 뒤부터다
        assertThat(boundArguments("queryForObject").subList(1, 5)).containsExactly("TOUR_API", "39", "12", "39");
    }

    @Test
    @DisplayName("타입별 활성 건수는 GROUP BY 한 번으로 받는다 — 타입마다 세지 않는다")
    void countsActiveByContentTypeInOneGroupedQuery() {
        adapter.countActiveByContentType("TOUR_API", "39", List.of("25", "38"));

        String sql = sqlOf("query");
        assertThat(sql).contains("SELECT content_type_id, COUNT(*)");
        assertThat(sql).contains("AND content_type_id IN (?, ?)");
        assertThat(sql).contains("GROUP BY content_type_id");
        // query 의 두 번째 인자는 콜백이라 값 인자는 그 뒤부터다
        assertThat(boundArguments("query").subList(1, 5)).containsExactly("TOUR_API", "39", "25", "38");
    }

    /** 첫 인자(SQL)를 뺀 바인딩 인자들. 가변인자는 호출 기록에서 펼쳐진 채로 나온다. */
    private List<Object> boundArguments(String methodName) {
        Object[] arguments = invocationOf(methodName).getArguments();
        return Arrays.asList(arguments).subList(1, arguments.length);
    }

    private String sqlOf(String methodName) {
        return (String) invocationOf(methodName).getArguments()[0];
    }

    private Invocation invocationOf(String methodName) {
        return mockingDetails(jdbcTemplate).getInvocations().stream()
            .filter(invocation -> invocation.getMethod().getName().equals(methodName))
            .findFirst()
            .orElseThrow(() -> new AssertionError(methodName + " 호출이 없다"));
    }
}
