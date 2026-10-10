package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.verifyNoInteractions;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlacePetInfo;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.Invocation;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * place_pet_info 쓰기 어댑터의 SQL 규칙과 바인딩 (#877). SQL 실행에는 실제 MySQL 이 필요해 여기서 못
 * 하지만, 값을 컬럼에 맞추는 규칙과 대상·삭제 조건은 DB 없이도 고정할 수 있다
 * ({@link JdbcPlaceIntroBulkAdapterTest} 와 같은 방식).
 */
class JdbcPlacePetInfoBulkAdapterTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final JdbcPlacePetInfoBulkAdapter adapter = new JdbcPlacePetInfoBulkAdapter(jdbcTemplate);

    @Test
    @DisplayName("컬럼 길이를 넘는 원문은 잘라서 바인딩하고 TEXT 인 기타 정보는 그대로 둔다")
    void truncatesOverlongValuesToColumnLength() {
        String longText = "가".repeat(2000);
        adapter.upsert(7L, ImportedPlacePetInfo.builder()
            .acmpyTypeCd(longText)
            .acmpyNeedMtr(longText)
            .etcAcmpyInfo(longText)
            .relaRntlPrdlst(longText)
            .allowanceScope("UNKNOWN")
            .allowedPetSize("UNKNOWN")
            .build());

        List<Object> arguments = boundArguments("update");
        // 0,1 = id, place_id / 2 = acmpy_type_cd / 4 = acmpy_need_mtr / 5 = etc_acmpy_info / 10 = rela_rntl_prdlst
        assertThat(arguments.get(0)).isEqualTo(7L);
        assertThat(arguments.get(1)).isEqualTo(7L);
        assertThat((String) arguments.get(2)).hasSize(100);
        assertThat((String) arguments.get(4)).hasSize(500);
        assertThat((String) arguments.get(5)).hasSize(2000);
        assertThat((String) arguments.get(10)).hasSize(300);
    }

    @Test
    @DisplayName("가공 세 칸을 마지막에 바인딩한다 — NOT NULL 컬럼이라 빠지면 INSERT 가 깨진다")
    void bindsDerivedColumnsLast() {
        adapter.upsert(7L, ImportedPlacePetInfo.builder()
            .acmpyTypeCd("전구역 동반가능")
            .allowanceScope("FULL_AREA")
            .allowedPetSize("ALL")
            .leashRequired(true)
            .build());

        List<Object> arguments = boundArguments("update");
        assertThat(arguments).hasSize(14);
        assertThat(arguments.subList(11, 14)).containsExactly("FULL_AREA", "ALL", true);
    }

    @Test
    @DisplayName("대상 쿼리는 원천·노출·증분 조건과 contentId 집합을 모두 들고 있다")
    void targetQueryKeepsOwnershipAndRotationRules() {
        adapter.findTourApiTargets(List.of(100L, 200L, 300L), 350);

        String sql = sqlOf("query");
        assertThat(sql).contains("p.source = 'TOUR_API'");
        assertThat(sql).contains("p.content_id IN (?, ?, ?)");
        assertThat(sql).contains("p.merged_into_id IS NULL");
        assertThat(sql).contains("p.delisted_at IS NULL");
        assertThat(sql).contains("ORDER BY ppi.synced_at IS NULL DESC, ppi.synced_at ASC, p.id ASC");
        // query 의 두 번째 인자는 RowMapper 라 값 인자는 그 뒤부터다
        assertThat(boundArguments("query").subList(1, 5)).containsExactly(100L, 200L, 300L, 350);
    }

    @Test
    @DisplayName("touch 는 UPDATE 뿐이다 — 행을 만들면 말해 주는 것 없는 동반 정보가 생긴다")
    void touchNeverInserts() {
        adapter.touchSyncedAt(42L);

        assertThat(sqlOf("update")).doesNotContain("INSERT").contains("UPDATE place_pet_info");
        assertThat(boundArguments("update")).containsExactly(42L);
    }

    @Test
    @DisplayName("삭제는 TourAPI 원천 행의 지정한 contentId 로만 간다")
    void deleteIsScopedToGivenContentIds() {
        adapter.deleteByContentIds(List.of(2925674L));

        String sql = sqlOf("update");
        assertThat(sql).contains("DELETE ppi").contains("p.source = 'TOUR_API'").contains("p.content_id IN (?)");
        assertThat(boundArguments("update")).containsExactly(2925674L);
    }

    @Test
    @DisplayName("빈 집합이나 상한 0 이면 쿼리하지 않는다 — IN () 는 문법 오류다")
    void foldsEmptyArgumentsWithoutQuerying() {
        assertThat(adapter.findTourApiTargets(List.of(), 350)).isEmpty();
        assertThat(adapter.findTourApiTargets(List.of(1L), 0)).isEmpty();
        assertThat(adapter.deleteByContentIds(List.of())).isZero();

        verifyNoInteractions(jdbcTemplate);
    }

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
