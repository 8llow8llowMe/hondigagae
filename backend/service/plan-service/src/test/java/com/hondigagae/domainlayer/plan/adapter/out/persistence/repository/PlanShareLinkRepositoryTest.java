package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanShareLinkEntity;
import com.hondigagae.persistence.config.JpaAuditConfig;
import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

/**
 * 공유 링크 리포지터리의 JPQL·제약 검증 (이슈 #627) — 컴파일로 검증되지 않아 실제 스키마에 질의해 본다.
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>벌크 폐기의 범위</b> — 해당 일정의 <b>미폐기 행만</b> 닫는다. 다른 일정을 건드리면
 *       남의 링크가 말없이 죽고, 이미 폐기된 행의 시각을 덮어쓰면 유출 추적 근거가 사라진다
 *   <li><b>유효 링크 선택</b> — 만료된 행은 멱등 발급이 재사용하면 안 된다. 재사용하면
 *       "발급했는데 열리지 않는 링크" 를 돌려주게 된다
 *   <li><b>토큰 유니크</b> — 같은 토큰 두 개는 DB 가 막는다
 *   <li><b>벌크 폐기가 {@code updatedAt} 도 찍는다</b> — JPA 감사를 우회하는 경로라 손으로 채운다
 * </ul>
 *
 * <h2>H2 를 {@code MODE=MySQL} 로 띄우는 이유</h2>
 *
 * {@code token} 컬럼이 {@code columnDefinition = "VARCHAR(64) COLLATE utf8mb4_bin"} 이다.
 * <b>H2 기본 모드는 컬럼 수준 {@code COLLATE} 를 파싱하지 못하고</b>, Hibernate 는 DDL 실패를
 * 예외가 아니라 WARN 으로 삼킨다 — 그래서 테이블이 조용히 만들어지지 않고 모든 케이스가
 * "Table PLAN_SHARE_LINK not found" 로 죽는다(실제로 겪었다). MySQL 모드는 그 구문을 받아들인다.
 *
 * <p><b>다만 H2 는 콜레이션을 받아들이기만 하고 적용하지는 않는다.</b> 그래서 이 테스트는
 * 유니크 제약이 <i>존재한다</i> 는 것까지만 증명하고, 운영에서 <i>대소문자를 구분해</i> 비교한다는
 * 것은 증명하지 못한다 — 그 확인은 dev 반영 뒤 MySQL 에서 해야 한다
 * ({@code backend/docs/services/plan-service.md} 의 "남은 위험 — 검증 공백").
 */
@DataJpaTest
@EntityScan("com.hondigagae.domainlayer")
@Import(JpaAuditConfig.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.url=jdbc:h2:mem:plan-share-link;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.datasource.username=sa",
    "spring.datasource.password="
})
class PlanShareLinkRepositoryTest {

    /** 애플리케이션 클래스를 슬라이스에 끌어오지 않기 위한 최소 설정 ({@code PlanRepositoryTest} 와 같다). */
    @SpringBootConfiguration
    @EnableJpaRepositories(basePackages = "com.hondigagae.domainlayer")
    static class SliceConfig {
    }

    private static final long PLAN_ID = 901L;
    private static final long OTHER_PLAN_ID = 902L;
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 17, 10, 30);
    private static final LocalDateTime EXPIRES_LATER = NOW.plusDays(30);
    private static final LocalDateTime EXPIRED_ALREADY = NOW.minusDays(1);
    private static final LocalDateTime REVOKED_EARLIER = NOW.minusDays(3);

    @Autowired
    private PlanShareLinkRepository planShareLinkRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    @DisplayName("스키마가 실제로 만들어졌다 — Hibernate 가 DDL 실패를 WARN 으로 삼키므로 여기서 먼저 가른다")
    void schemaIsActuallyCreated() {
        // 이 단언이 깨지면 엔티티의 columnDefinition 을 H2 가 못 읽은 것이다.
        // 그대로 두면 나머지 케이스가 전부 "Table PLAN_SHARE_LINK not found" 로 죽어 원인이 가려진다.
        assertThat(entityManager.createNativeQuery("select count(*) from plan_share_link").getSingleResult())
            .isNotNull();
    }

    @Test
    @DisplayName("벌크 폐기는 해당 일정의 미폐기 행만 닫는다 — 다른 일정과 이미 폐기된 행은 그대로다")
    void revokeClosesOnlyActiveLinksOfThatPlan() {
        save(1L, PLAN_ID, "token-active-1", EXPIRES_LATER, null);
        save(2L, PLAN_ID, "token-active-2", EXPIRES_LATER, null);
        save(3L, PLAN_ID, "token-already-revoked", EXPIRES_LATER, REVOKED_EARLIER);
        save(4L, OTHER_PLAN_ID, "token-other-plan", EXPIRES_LATER, null);

        int closed = planShareLinkRepository.revokeActiveByPlanId(PLAN_ID, NOW);
        entityManager.clear();

        assertThat(closed).isEqualTo(2);
        assertThat(revokedAtOf("token-active-1")).isEqualTo(NOW);
        assertThat(revokedAtOf("token-active-2")).isEqualTo(NOW);
        assertThat(revokedAtOf("token-already-revoked")).isEqualTo(REVOKED_EARLIER);
        assertThat(revokedAtOf("token-other-plan")).isNull();
    }

    @Test
    @DisplayName("벌크 폐기가 updatedAt 도 함께 찍는다 — JPA 감사를 우회하므로 손으로 채운다")
    void revokeAlsoStampsUpdatedAt() {
        save(1L, PLAN_ID, "token-active", EXPIRES_LATER, null);
        LocalDateTime beforeRevoke = planShareLinkRepository.findByToken("token-active").orElseThrow().getUpdatedAt();

        planShareLinkRepository.revokeActiveByPlanId(PLAN_ID, NOW);
        entityManager.clear();

        PlanShareLinkEntity closed = planShareLinkRepository.findByToken("token-active").orElseThrow();
        assertThat(closed.getUpdatedAt()).isEqualTo(NOW).isEqualTo(closed.getRevokedAt());
        assertThat(closed.getUpdatedAt()).isNotEqualTo(beforeRevoke);
    }

    @Test
    @DisplayName("닫을 링크가 없어도 0건으로 성공한다 — 폐기는 멱등이다")
    void revokeWithoutAnyActiveLinkAffectsNothing() {
        save(1L, PLAN_ID, "token-already-revoked", EXPIRES_LATER, REVOKED_EARLIER);

        assertThat(planShareLinkRepository.revokeActiveByPlanId(PLAN_ID, NOW)).isZero();
    }

    @Test
    @DisplayName("유효 링크 조회는 만료·폐기된 행과 다른 일정의 행을 제외하고 최신 하나를 고른다")
    void findValidExcludesExpiredAndRevoked() {
        save(1L, PLAN_ID, "token-expired", EXPIRED_ALREADY, null);
        save(2L, PLAN_ID, "token-revoked", EXPIRES_LATER, REVOKED_EARLIER);
        save(3L, PLAN_ID, "token-valid-old", EXPIRES_LATER, null);
        save(4L, PLAN_ID, "token-valid-new", EXPIRES_LATER, null);
        save(5L, OTHER_PLAN_ID, "token-other-plan", EXPIRES_LATER, null);

        Optional<PlanShareLinkEntity> found = planShareLinkRepository
            .findFirstByPlanIdAndRevokedAtIsNullAndExpiresAtAfterOrderByIdDesc(PLAN_ID, NOW);

        assertThat(found).get().extracting(PlanShareLinkEntity::getToken).isEqualTo("token-valid-new");
    }

    @Test
    @DisplayName("만료 시각이 지난 행은 유효 링크에서 빠진다 — 재사용하면 열리지 않는 링크를 돌려주게 된다")
    void findValidReturnsEmptyWhenEveryLinkExpired() {
        save(1L, PLAN_ID, "token-expired", EXPIRED_ALREADY, null);

        assertThat(planShareLinkRepository
            .findFirstByPlanIdAndRevokedAtIsNullAndExpiresAtAfterOrderByIdDesc(PLAN_ID, NOW)).isEmpty();
    }

    @Test
    @DisplayName("같은 토큰 두 개는 uk_plan_share_link_token 이 막는다")
    void tokenIsUnique() {
        save(1L, PLAN_ID, "token-duplicated", EXPIRES_LATER, null);

        assertThatThrownBy(() -> save(2L, OTHER_PLAN_ID, "token-duplicated", EXPIRES_LATER, null))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("토큰으로 찾는다 — 폐기·만료 여부와 무관하게 행 자체는 돌아온다 (판정은 도메인이 한다)")
    void findByTokenReturnsRevokedRowToo() {
        save(1L, PLAN_ID, "token-revoked", EXPIRES_LATER, REVOKED_EARLIER);

        assertThat(planShareLinkRepository.findByToken("token-revoked"))
            .get().extracting(PlanShareLinkEntity::getRevokedAt).isEqualTo(REVOKED_EARLIER);
    }

    private LocalDateTime revokedAtOf(String token) {
        return planShareLinkRepository.findByToken(token).orElseThrow().getRevokedAt();
    }

    /**
     * 벌크 DML 과 제약 위반을 보려면 INSERT 가 실제로 나가 있어야 해서 저장마다 flush 한다.
     *
     * <p>{@code entityManager.flush()} 가 아니라 {@code saveAndFlush} 를 쓴다 — 리포지터리 프록시를
     * 거쳐야 Hibernate 의 제약 위반이 스프링 {@code DataIntegrityViolationException} 으로 번역된다.
     */
    private void save(long id, long planId, String token, LocalDateTime expiresAt, LocalDateTime revokedAt) {
        planShareLinkRepository.saveAndFlush(PlanShareLinkEntity.builder()
            .id(id).planId(planId).token(token).expiresAt(expiresAt).revokedAt(revokedAt)
            .build());
    }
}
