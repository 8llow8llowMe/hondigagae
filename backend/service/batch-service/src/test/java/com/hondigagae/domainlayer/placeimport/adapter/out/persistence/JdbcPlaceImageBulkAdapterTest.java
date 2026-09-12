package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.Invocation;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * place_image 어댑터의 <b>증분 대상 선정</b> 검증 (#478). SQL 실행에는 실제 MySQL 이 필요해
 * 여기서 못 하지만, 증분 전략을 지탱하는 문구와 바인딩은 DB 없이도 고정할 수 있다.
 *
 * <p>이 SQL 은 컴파일로 검증되지 않고 고장 나도 조용하다 — 정렬 한 줄이 지워지면 스텝은 그대로
 * 성공하면서 <b>매 실행 같은 400곳만 돌게 된다.</b> 나머지 564곳은 영영 갱신되지 않는데
 * 로그상으로는 정상이다.
 *
 * <p>인자를 {@code ArgumentCaptor} 대신 호출 기록에서 직접 읽는 이유는 {@code JdbcTemplate}
 * 메서드가 가변인자라서다 — 캡터는 가변인자 한 칸만 잡는다 (intro 어댑터 테스트와 같은 방식).
 */
class JdbcPlaceImageBulkAdapterTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final JdbcPlaceImageBulkAdapter adapter = new JdbcPlaceImageBulkAdapter(jdbcTemplate);

    @Test
    @DisplayName("대상 쿼리는 원천·노출·증분 조건을 모두 들고 있다 — 하나만 지워져도 조용한 사고가 된다")
    void targetQueryKeepsOwnershipAndRotationRules() {
        adapter.findTourApiTargets(400);

        String sql = sqlOf("query");
        // detailImage2 가 없는 원천(문화정보원·식약처)에 쿼터를 쓰지 않는다
        assertThat(sql).contains("p.source = 'TOUR_API'");
        assertThat(sql).contains("p.content_id IS NOT NULL");
        // 화면에 안 나오는 장소에 희소한 쿼터를 쓰지 않는다
        assertThat(sql).contains("p.merged_into_id IS NULL");
        assertThat(sql).contains("p.delisted_at IS NULL");
        // 증분 전략 전체가 이 정렬 한 줄에 걸려 있다 (운영시간 대상 쿼리와 같은 3단)
        assertThat(sql).contains("ORDER BY p.image_synced_at IS NULL DESC, p.image_synced_at ASC, p.id ASC");
        assertThat(sql).contains("LIMIT ?");
    }

    @Test
    @DisplayName("상한을 마지막 인자로 바인딩한다 — 이게 빠지면 다시 전량 964콜이다")
    void bindsLimit() {
        adapter.findTourApiTargets(400);

        // query 의 첫 인자는 SQL, 그다음이 RowMapper 라 값 인자는 그 뒤부터다
        assertThat(boundArguments("query").subList(1, 2)).containsExactly(400);
    }

    @Test
    @DisplayName("상한이 0 이하면 쿼리 자체를 하지 않는다 — 프로퍼티가 접히지 않은 상태의 방어선이다")
    void foldsNonPositiveLimitWithoutQuerying() {
        assertThat(adapter.findTourApiTargets(0)).isEmpty();
        assertThat(adapter.findTourApiTargets(-1)).isEmpty();

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("touch 는 image_synced_at 만 민다 — 목록 적재의 synced_at 을 건드리지 않는다")
    void touchMovesOnlyTheImageCursor() {
        adapter.touchImageSyncedAt(42L);

        String sql = sqlOf("update");
        assertThat(sql).contains("UPDATE place");
        assertThat(sql).contains("image_synced_at = NOW()");
        // "SET synced_at" 을 쓰면 목록 적재의 적재 시각을 이미지 스텝이 덮는다
        assertThat(sql).doesNotContain("SET synced_at");
        assertThat(sql).contains("WHERE id = ?");
        assertThat(boundArguments("update")).containsExactly(42L);
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
