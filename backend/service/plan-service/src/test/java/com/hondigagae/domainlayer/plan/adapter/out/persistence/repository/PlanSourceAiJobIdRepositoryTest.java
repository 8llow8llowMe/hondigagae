package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanEntity;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.persistence.config.JpaAuditConfig;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * AI 초안 담기 멱등 키 (#970) — 파생 쿼리와 유니크 {@code uk_plan_member_id_source_ai_job_id} 를 실제 스키마로 확인한다.
 *
 * <p>동시 담기의 마지막 방어선은 이 유니크다. Facade 는 여기서 나는 {@link DataIntegrityViolationException} 을 받아
 * 먼저 담긴 일정을 돌려준다 — 예외 타입이 바뀌면 멱등이 500 으로 무너진다.
 *
 * <p><b>H2 로 증명되지 않는 것</b>: MySQL 의 "유니크 인덱스에서 NULL 은 서로 다르다" 는 의미론. H2 도 같게
 * 동작해 아래 NULL 공존 테스트는 초록이지만, dev 반영 뒤
 * {@code SHOW INDEX FROM plan WHERE Key_name='uk_plan_member_id_source_ai_job_id'} 로 인덱스가 실제로 만들어졌는지 본다.
 */
@DataJpaTest
@EntityScan("com.hondigagae.domainlayer")
@Import(JpaAuditConfig.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlanSourceAiJobIdRepositoryTest {

    @SpringBootConfiguration
    @EnableJpaRepositories(basePackages = "com.hondigagae.domainlayer")
    static class SliceConfig {
    }

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final String JOB_ID = "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f";
    private static final String OTHER_JOB_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

    @Autowired
    private PlanRepository planRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    @DisplayName("같은 회원·같은 작업으로 담은 살아 있는 일정을 찾는다")
    void findsCommittedPlan() {
        planRepository.saveAndFlush(plan(901L, MEMBER_ID, JOB_ID, false));

        assertThat(planRepository.findByMemberIdAndSourceAiJobIdAndDeletedFalse(MEMBER_ID, JOB_ID))
            .map(PlanEntity::getId).hasValue(901L);
    }

    @Test
    @DisplayName("다른 작업·남의 회원·삭제된 일정은 찾지 않는다")
    void missesOtherJobOtherMemberAndDeleted() {
        planRepository.saveAndFlush(plan(901L, MEMBER_ID, JOB_ID, false));
        // 삭제는 키를 비우지만(Plan.markDeleted), 비우기 전 행이 남아 있어도 조회 조건이 거른다.
        planRepository.saveAndFlush(plan(902L, MEMBER_ID, OTHER_JOB_ID, true));

        assertThat(planRepository.findByMemberIdAndSourceAiJobIdAndDeletedFalse(MEMBER_ID, OTHER_JOB_ID)).isEmpty();
        assertThat(planRepository.findByMemberIdAndSourceAiJobIdAndDeletedFalse(OTHER_MEMBER_ID, JOB_ID)).isEmpty();
        assertThat(planRepository.findByMemberIdAndSourceAiJobIdAndDeletedFalse(MEMBER_ID, "a0000000-0000-4000-8000-000000000000"))
            .isEmpty();
    }

    @Test
    @DisplayName("같은 회원·같은 작업의 두 번째 일정은 유니크 위반(DataIntegrityViolationException)이다")
    void rejectsSecondPlanForSameJob() {
        planRepository.saveAndFlush(plan(901L, MEMBER_ID, JOB_ID, false));

        assertThatThrownBy(() -> planRepository.saveAndFlush(plan(902L, MEMBER_ID, JOB_ID, false)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    /**
     * 실제 담기에서는 {@code save} 가 merge 라 INSERT 가 <b>커밋 때</b> 나간다 — 저장소 호출이 아니라 트랜잭션 매니저가
     * 위반을 받는다. 그 경로도 {@link DataIntegrityViolationException} 으로 번역돼야 Facade 의 재조회가 탄다.
     * 테스트 트랜잭션을 끄고 각 저장을 자기 트랜잭션으로 커밋해 그 경로를 그대로 밟는다.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @DisplayName("커밋 시점에 난 유니크 위반도 DataIntegrityViolationException 으로 번역된다")
    void translatesViolationRaisedAtCommit() {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        try {
            transaction.executeWithoutResult(status -> planRepository.save(plan(901L, MEMBER_ID, JOB_ID, false)));

            assertThatThrownBy(() -> transaction.executeWithoutResult(
                status -> planRepository.save(plan(902L, MEMBER_ID, JOB_ID, false))))
                .isInstanceOf(DataIntegrityViolationException.class);
        } finally {
            transaction.executeWithoutResult(status -> planRepository.deleteAll());
        }
    }

    @Test
    @DisplayName("키가 없는 일정(일반 생성·옛 일정·삭제된 일정)은 몇 개든 공존한다")
    void allowsManyPlansWithoutJob() {
        planRepository.saveAndFlush(plan(901L, MEMBER_ID, null, false));
        planRepository.saveAndFlush(plan(902L, MEMBER_ID, null, false));
        planRepository.saveAndFlush(plan(903L, MEMBER_ID, null, true));

        assertThat(planRepository.count()).isEqualTo(3);
    }

    @Test
    @DisplayName("다른 회원은 같은 jobId 로 담아도 공존한다 — 키는 회원 네임스페이스 안에서만 유일하다")
    void allowsSameJobForDifferentMembers() {
        planRepository.saveAndFlush(plan(901L, MEMBER_ID, JOB_ID, false));
        planRepository.saveAndFlush(plan(902L, OTHER_MEMBER_ID, JOB_ID, false));

        assertThat(planRepository.findByMemberIdAndSourceAiJobIdAndDeletedFalse(OTHER_MEMBER_ID, JOB_ID))
            .map(PlanEntity::getId).hasValue(902L);
    }

    private static PlanEntity plan(long id, long memberId, String sourceAiJobId, boolean deleted) {
        return PlanEntity.builder()
            .id(id).memberId(memberId).petId(7L).areaCode("39").title("일정 " + id)
            .startDate(LocalDate.of(2026, 9, 12)).endDate(LocalDate.of(2026, 9, 14))
            .status(PlanStatus.DRAFT).deleted(deleted).sourceAiJobId(sourceAiJobId)
            .build();
    }
}
