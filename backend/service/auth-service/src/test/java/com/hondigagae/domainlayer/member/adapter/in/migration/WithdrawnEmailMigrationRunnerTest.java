package com.hondigagae.domainlayer.member.adapter.in.migration;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.member.application.port.out.WithdrawnEmailMigrationPort;
import com.hondigagae.domainlayer.member.application.port.out.query.WithdrawnMemberQueryResult;
import com.hondigagae.domainlayer.member.application.service.support.WithdrawnEmailHasher;
import com.hondigagae.global.properties.WithdrawnEmailProperties;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 기존 탈퇴 행의 이메일 원문을 다이제스트로 바꾸는 일회성 러너.
 *
 * <p>확인할 것은 둘이다 — <b>원문 행만 바꾸는가</b>(이미 처리된 행을 다시 건드리면 다이제스트의
 * 다이제스트가 되어 재가입 차단이 영구히 깨진다), 그리고 <b>두 번 돌아도 안전한가</b>.
 */
class WithdrawnEmailMigrationRunnerTest {

    private static final String PEPPER = "migration-runner-test-pepper-0123456789abcdef";
    private static final String RAW_EMAIL = "tester@example.com";
    private static final LocalDateTime UPDATED_AT = LocalDateTime.of(2026, 1, 10, 12, 0);

    private StubWithdrawnEmailMigrationPort migrationPort;
    private WithdrawnEmailHasher hasher;
    private WithdrawnEmailMigrationRunner runner;

    @BeforeEach
    void setUp() {
        migrationPort = new StubWithdrawnEmailMigrationPort();
        hasher = new WithdrawnEmailHasher(new WithdrawnEmailProperties(PEPPER));
        runner = new WithdrawnEmailMigrationRunner(migrationPort, hasher);
    }

    @Test
    @DisplayName("원문이 남은 탈퇴 행을 다이제스트로 바꾸고 withdrawnAt 을 updatedAt 으로 채운다")
    void replacesRawEmailAndFillsWithdrawnAt() {
        migrationPort.register(new WithdrawnMemberQueryResult(1L, RAW_EMAIL, null, UPDATED_AT));

        runner.run(null);

        assertThat(migrationPort.replacements).hasSize(1);
        Replacement replacement = migrationPort.replacements.get(0);
        assertThat(replacement.emailDigest()).isEqualTo(hasher.hash(RAW_EMAIL));
        // 정확한 탈퇴 시각을 알 수 없어 updatedAt 으로 근사한다.
        assertThat(replacement.withdrawnAt()).isEqualTo(UPDATED_AT);
    }

    @Test
    @DisplayName("withdrawnAt 이 이미 있으면 덮어쓰지 않는다")
    void keepsExistingWithdrawnAt() {
        LocalDateTime knownWithdrawnAt = LocalDateTime.of(2025, 12, 1, 9, 30);
        migrationPort.register(new WithdrawnMemberQueryResult(1L, RAW_EMAIL, knownWithdrawnAt, UPDATED_AT));

        runner.run(null);

        assertThat(migrationPort.replacements.get(0).withdrawnAt()).isEqualTo(knownWithdrawnAt);
    }

    @Test
    @DisplayName("두 번 돌아도 안전하다 — 이미 다이제스트인 행은 대상에 잡히지 않는다")
    void isIdempotent() {
        migrationPort.register(new WithdrawnMemberQueryResult(1L, RAW_EMAIL, null, UPDATED_AT));

        runner.run(null);
        runner.run(null);

        // 두 번째 실행의 대상은 0건이어야 한다 — 치환된 값에는 '@' 가 없기 때문이다.
        assertThat(migrationPort.replacements).hasSize(1);
        assertThat(migrationPort.rows.get(1L)).doesNotContain("@");
    }

    @Test
    @DisplayName("대상이 없으면 아무것도 하지 않는다")
    void doesNothingWhenNoTargets() {
        runner.run(null);

        assertThat(migrationPort.replacements).isEmpty();
    }

    private record Replacement(long memberId, String emailDigest, LocalDateTime withdrawnAt) {

    }

    /**
     * 러너의 대상 판별을 실제와 같은 규칙("email 에 {@code @} 가 있는 행")으로 흉내 낸다 —
     * 이 규칙이 멱등성의 근거라, 스텁에서 단순화하면 검증할 것이 남지 않는다.
     */
    private static class StubWithdrawnEmailMigrationPort implements WithdrawnEmailMigrationPort {

        private final Map<Long, String> rows = new LinkedHashMap<>();
        private final Map<Long, LocalDateTime> withdrawnAts = new LinkedHashMap<>();
        private final Map<Long, LocalDateTime> updatedAts = new LinkedHashMap<>();
        private final List<Replacement> replacements = new ArrayList<>();

        void register(WithdrawnMemberQueryResult row) {
            rows.put(row.id(), row.email());
            withdrawnAts.put(row.id(), row.withdrawnAt());
            updatedAts.put(row.id(), row.updatedAt());
        }

        @Override
        public List<WithdrawnMemberQueryResult> findWithdrawnMembersWithRawEmail() {
            return rows.entrySet().stream()
                .filter(entry -> entry.getValue().contains("@"))
                .map(entry -> new WithdrawnMemberQueryResult(
                    entry.getKey(), entry.getValue(),
                    withdrawnAts.get(entry.getKey()), updatedAts.get(entry.getKey())))
                .toList();
        }

        @Override
        public void replaceWithdrawnEmail(long memberId, String emailDigest, LocalDateTime withdrawnAt) {
            rows.put(memberId, emailDigest);
            withdrawnAts.put(memberId, withdrawnAt);
            replacements.add(new Replacement(memberId, emailDigest, withdrawnAt));
        }
    }
}
