package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 적재 SQL 의 <b>컬럼 규칙</b> 검증. 실행에는 실제 MySQL 이 필요해 여기서 못 하지만, "어느 컬럼을
 * 넣고 어느 컬럼을 비우는가" 는 SQL 텍스트만으로 고정할 수 있다.
 *
 * <p>이 규칙이 틀어졌을 때 무슨 일이 났는지가 이 테스트가 있는 이유다 (#753) — 관광 API 적재가
 * indoor / outdoor 에 리터럴 {@code false} 를 박아 "모른다" 와 "실외다" 를 같은 값으로 만들었고,
 * 그 결과 비 오는 날 실내 대안에서 관광 API 장소가 전부 배제됐다. 게다가 병합의
 * {@code COALESCE(survivor.indoor, absorbed.indoor)} 가 survivor 값이 절대 NULL 이 아니라
 * <b>영구 no-op</b> 이 돼, 문화정보원이 아는 실내외를 병합할 때마다 조용히 버렸다.
 *
 * <p><b>컴파일도 테스트도 통과하는 종류의 결함이라</b> 텍스트로 잠근다.
 */
class JdbcPlaceBulkAdapterSqlTest {

    @Test
    @DisplayName("관광 API 적재는 indoor·outdoor 를 넣지 않는다 — 원천이 모르는 값을 false 로 뭉개지 않는다")
    void tourApiUpsertLeavesIndoorAndOutdoorNull() {
        List<String> columns = insertColumnsOf("UPSERT_SQL");

        assertThat(columns).doesNotContain("indoor", "outdoor");
    }

    @Test
    @DisplayName("관광 API 적재는 UPDATE 절에서도 indoor·outdoor 를 건드리지 않는다 — 병합이 채워 둔 값을 재적재가 지우면 안 된다")
    void tourApiUpsertDoesNotOverwriteMergedIndoorOnUpdate() {
        String updateClause = updateClauseOf("UPSERT_SQL");

        assertThat(updateClause).doesNotContain("indoor").doesNotContain("outdoor");
    }

    @Test
    @DisplayName("실내외를 아는 원천(문화정보원)은 그 값을 싣는다 — 규칙은 '모르면 비운다' 이지 '항상 비운다' 가 아니다")
    void cultureUpsertCarriesIndoorAndOutdoor() {
        List<String> columns = insertColumnsOf("CULTURE_UPSERT_SQL");

        assertThat(columns).contains("indoor", "outdoor");
    }

    @Test
    @DisplayName("식약처 적재도 indoor·outdoor 를 비운다 — 관광 API 와 같은 규칙이다")
    void mfdsUpsertLeavesIndoorAndOutdoorNull() {
        List<String> columns = insertColumnsOf("MFDS_UPSERT_SQL");

        assertThat(columns).doesNotContain("indoor", "outdoor");
    }

    /**
     * 컬럼 목록과 VALUES 항목 수가 어긋나면 런타임에야 터진다. 컬럼을 빼면서 리터럴을 안 빼는 것이
     * 정확히 이 실수라, #753 수정과 같은 변경을 할 때 여기서 걸리게 둔다.
     */
    @Test
    @DisplayName("적재 SQL 모두 컬럼 수와 VALUES 항목 수가 같다")
    void everyUpsertKeepsColumnsAndValuesAligned() {
        for (String sqlField : List.of("UPSERT_SQL", "CULTURE_UPSERT_SQL", "CULTURE_INTRO_UPSERT_SQL",
            "MFDS_UPSERT_SQL")) {
            assertThat(insertColumnsOf(sqlField))
                .as("%s 의 컬럼 수", sqlField)
                .hasSameSizeAs(insertValuesOf(sqlField));
        }
    }

    /**
     * <b>개수만 세면 리터럴이 한 칸 밀린 것을 못 잡는다.</b> indoor / outdoor 대신 실수로
     * pet_available 의 {@code false} 와 pet_allowance_type 의 {@code 'UNKNOWN'} 을 뺐어도 컬럼 수와
     * 값 수는 그대로 같고, 대신 pet_only 에 {@code 'UNKNOWN'} 이 allowed_pet_size 에 {@code false} 가
     * 들어가 런타임에야 터진다. 그래서 리터럴을 <b>컬럼 이름에 묶어</b> 고정한다.
     */
    @Test
    @DisplayName("관광 API 적재의 리터럴이 제 컬럼 자리에 있다 — 한 칸 밀리면 pet_only 에 'UNKNOWN' 이 들어간다")
    void tourApiUpsertLiteralsStayOnTheirOwnColumns() {
        assertThat(literalAt("UPSERT_SQL", "pet_available")).isEqualTo("false");
        assertThat(literalAt("UPSERT_SQL", "pet_allowance_type")).isEqualTo("'UNKNOWN'");
        assertThat(literalAt("UPSERT_SQL", "pet_only")).isEqualTo("false");
        assertThat(literalAt("UPSERT_SQL", "allowed_pet_size")).isEqualTo("'UNKNOWN'");
        assertThat(literalAt("UPSERT_SQL", "source")).isEqualTo("'TOUR_API'");
        assertThat(literalAt("UPSERT_SQL", "created_at")).isEqualTo("NOW()");
        assertThat(literalAt("UPSERT_SQL", "updated_at")).isEqualTo("NOW()");
    }

    /** 컬럼 이름에 대응하는 VALUES 항목. 같은 자리끼리 묶어 읽는다. */
    private static String literalAt(String fieldName, String column) {
        List<String> columns = insertColumnsOf(fieldName);
        int index = columns.indexOf(column);
        assertThat(index).as("%s 에 %s 컬럼이 있어야 한다", fieldName, column).isNotNegative();
        return insertValuesOf(fieldName).get(index);
    }

    /** 테이블 이름은 고정하지 않는다 — {@code place} 말고 {@code place_intro} 도 같은 규칙으로 읽는다. */
    private static final Pattern INSERT_HEAD = Pattern.compile("INSERT INTO\\s+(\\w+)\\s*\\(");

    private static List<String> insertColumnsOf(String fieldName) {
        String sql = sqlOf(fieldName);
        Matcher head = INSERT_HEAD.matcher(sql);
        if (!head.find()) {
            throw new IllegalStateException(fieldName + " 에서 INSERT 절을 찾지 못했다 — SQL 모양이 바뀌었다");
        }
        String columns = sql.substring(head.end(), sql.indexOf(") VALUES"));
        return Arrays.stream(columns.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    /** VALUES 절을 괄호 깊이로 잘라 최상위 콤마만 항목 구분으로 본다 — {@code NOW()} 를 둘로 세지 않기 위해서다. */
    private static List<String> insertValuesOf(String fieldName) {
        String sql = sqlOf(fieldName);
        String rest = sql.substring(sql.indexOf(") VALUES (") + ") VALUES (".length());

        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int depth = 0;
        for (char c : rest.toCharArray()) {
            if (c == '(') {
                depth++;
            } else if (c == ')') {
                if (depth == 0) {
                    break;
                }
                depth--;
            }
            if (c == ',' && depth == 0) {
                values.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        if (!current.toString().isBlank()) {
            values.add(current.toString().trim());
        }
        return values;
    }

    private static String updateClauseOf(String fieldName) {
        String sql = sqlOf(fieldName);
        return sql.substring(sql.indexOf("ON DUPLICATE KEY UPDATE"));
    }

    private static String sqlOf(String fieldName) {
        try {
            Field field = JdbcPlaceBulkAdapter.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            return (String) field.get(null);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(fieldName + " 를 읽지 못했다 — 상수 이름이 바뀌었는지 확인한다", e);
        }
    }
}
