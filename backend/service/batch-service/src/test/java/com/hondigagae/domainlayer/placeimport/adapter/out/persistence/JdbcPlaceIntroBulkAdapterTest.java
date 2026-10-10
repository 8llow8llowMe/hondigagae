package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.verifyNoInteractions;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.Invocation;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * place_intro 쓰기 어댑터의 <b>바인딩</b> 검증. SQL 실행에는 실제 MySQL 이 필요해 여기서 못 하지만,
 * 값을 컬럼에 맞추는 규칙(자르기·spec 버리기)과 인자 순서는 DB 없이도 고정할 수 있다.
 *
 * <p>이 규칙이 틀어지면 dev 기동 때 {@code Data too long} 으로 스텝 전체가 죽거나, 더 나쁘게는
 * 잘린 spec 이 조용히 잘못된 {@code openNow} 를 만든다.
 *
 * <p>인자를 {@code ArgumentCaptor} 대신 호출 기록에서 직접 읽는 이유는 {@code JdbcTemplate#update}
 * 가 가변인자라서다 — 캡터는 가변인자 한 칸만 잡는다.
 */
class JdbcPlaceIntroBulkAdapterTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final JdbcPlaceIntroBulkAdapter adapter = new JdbcPlaceIntroBulkAdapter(jdbcTemplate);

    @Test
    @DisplayName("컬럼 길이를 넘는 값은 잘라서 바인딩한다 — 자르지 않으면 Data too long 으로 스텝이 죽는다")
    void truncatesOverlongValuesToColumnLength() {
        adapter.upsert(7L, ImportedPlaceIntro.builder()
            .infoCenter("문의처".repeat(200))
            .useTime("운영시간".repeat(200))
            .chkBabyCarriage("유모차".repeat(200))
            .build());

        List<Object> arguments = boundArguments("update");
        // 0,1 = id, place_id / 2 = info_center / 3 = use_time / 9 = chk_baby_carriage
        assertThat(arguments.get(0)).isEqualTo(7L);
        assertThat(arguments.get(1)).isEqualTo(7L);
        assertThat((String) arguments.get(2)).hasSize(200);
        assertThat((String) arguments.get(3)).hasSize(300);
        assertThat((String) arguments.get(9)).hasSize(100);
    }

    @Test
    @DisplayName("컬럼을 넘는 spec 은 자르지 않고 버린다 — 잘린 spec 은 짧은 spec 이 아니라 틀린 spec 이다")
    void dropsOverlongSpecInsteadOfTruncating() {
        adapter.upsert(7L, ImportedPlaceIntro.builder()
            .useTime("09:00~18:00")
            .weeklyHoursSpec("1234567:0900-1800;".repeat(30))
            .build());

        assertThat(boundArguments("update").get(4)).isNull();
    }

    @Test
    @DisplayName("길이 안쪽 값은 그대로 두고 open24 는 NOT NULL 이라 항상 값이 간다")
    void bindsValuesWithinColumnLengthAsIs() {
        adapter.upsert(7L, ImportedPlaceIntro.builder()
            .useTime("09:00~18:00")
            .weeklyHoursSpec("1234567:0900-1800")
            .open24(true)
            .restDate("연중무휴")
            .build());

        List<Object> arguments = boundArguments("update");
        assertThat(arguments.get(3)).isEqualTo("09:00~18:00");
        assertThat(arguments.get(4)).isEqualTo("1234567:0900-1800");
        assertThat(arguments.get(5)).isEqualTo(true);
        assertThat(arguments.get(6)).isEqualTo("연중무휴");
    }

    @Test
    @DisplayName("synced_at touch 는 행이 없을 때를 대비해 id 와 place_id 를 함께 넘긴다")
    void touchBindsPlaceIdTwice() {
        adapter.touchSyncedAt(42L);

        assertThat(boundArguments("update")).containsExactly(42L, 42L);
    }

    @Test
    @DisplayName("타입 목록을 content_type_id 문자열로 바꿔 바인딩하고 상한을 마지막 인자로 넘긴다")
    void bindsContentTypeCodesAndLimit() {
        adapter.findTourApiTargets(PlaceContentType.INTRO_HOURS_TARGETS, 300);

        assertThat(sqlOf("query")).contains("IN (?, ?, ?, ?, ?)");
        // query 의 두 번째 인자는 RowMapper 라 값 인자는 그 뒤부터다
        assertThat(boundArguments("query").subList(1, 7))
            .containsExactly("12", "14", "28", "38", "39", 300);
    }

    @Test
    @DisplayName("대상 쿼리는 원천·노출·증분 조건을 모두 들고 있다 — 하나만 지워져도 조용한 사고가 된다")
    void targetQueryKeepsOwnershipAndRotationRules() {
        adapter.findTourApiTargets(PlaceContentType.INTRO_HOURS_TARGETS, 300);

        String sql = sqlOf("query");
        // source 게이트가 없으면 이 upsert 가 문화정보원 장소의 운영시간을 덮는다
        // (JdbcPlaceBulkAdapter.CULTURE_INTRO_UPSERT_SQL 이 같은 컬럼을 쓴다)
        assertThat(sql).contains("p.source = 'TOUR_API'");
        // 화면에 안 나오는 장소에 희소한 쿼터를 쓰지 않는다
        assertThat(sql).contains("p.merged_into_id IS NULL");
        assertThat(sql).contains("p.delisted_at IS NULL");
        // 증분 전략 전체가 이 정렬 한 줄에 걸려 있다
        assertThat(sql).contains("ORDER BY pi.synced_at IS NULL DESC, pi.synced_at ASC, p.id ASC");
        assertThat(sql).contains("LIMIT ?");
    }

    @Test
    @DisplayName("대상 타입이 없거나 상한이 0 이하면 쿼리 자체를 하지 않는다 — IN () 는 문법 오류다")
    void foldsEmptyArgumentsWithoutQuerying() {
        assertThat(adapter.findTourApiTargets(List.of(), 300)).isEmpty();
        assertThat(adapter.findTourApiTargets(PlaceContentType.INTRO_HOURS_TARGETS, 0)).isEmpty();

        verifyNoInteractions(jdbcTemplate);
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
