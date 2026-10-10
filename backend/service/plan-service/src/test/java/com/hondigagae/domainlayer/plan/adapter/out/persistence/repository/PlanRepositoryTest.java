package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanEntity;
import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPetEntity;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.persistence.config.JpaAuditConfig;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

/**
 * 반려견별 히스토리 JPQL 검증 — 컴파일로 검증되지 않아 실제 스키마에 질의해 본다.
 *
 * <p>고정하는 것은 "한 마리라도 동행이면 히트" 다. 옛 일정(조인 테이블 행 없음)은 대표 컬럼으로,
 * 새 일정의 두 번째 이후 반려견은 조인 테이블로 찾아야 한다. 어느 한쪽만 보면 히스토리에서 빠진다.
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
class PlanRepositoryTest {

    /**
     * 애플리케이션 클래스({@code @EnableFeignClients}·{@code @EnableDiscoveryClient})를 슬라이스에 끌어오지
     * 않기 위한 최소 설정. 리포지터리 스캔은 자동 설정이 패키지를 모르므로 직접 지정한다.
     */
    @SpringBootConfiguration
    @EnableJpaRepositories(basePackages = "com.hondigagae.domainlayer")
    static class SliceConfig {
    }

    private static final long MEMBER_ID = 1L;
    private static final long MONGSIL = 2L;
    private static final long BORI = 5L;
    private static final PageRequest FIRST_PAGE = PageRequest.of(0, 10);

    @Autowired
    private PlanRepository planRepository;

    @Autowired
    private PlanPetRepository planPetRepository;

    @Test
    @DisplayName("조인 테이블에 두 번째로 들어 있는 반려견으로도 일정이 조회된다 — 한 마리라도 동행이면 히트")
    void findsPlanWhereJoinTableCarriesThePet() {
        savePlan(901L, MONGSIL);
        savePlanPets(901L, MONGSIL, BORI);

        List<PlanEntity> found = planRepository.findMyPlansWithPet(MEMBER_ID, BORI, Long.MAX_VALUE, FIRST_PAGE).getContent();

        assertThat(found).extracting(PlanEntity::getId).containsExactly(901L);
    }

    @Test
    @DisplayName("조인 테이블 행이 없는 옛 일정은 대표 컬럼(plan.pet_id)으로 조회된다")
    void findsLegacyPlanByRepresentativeColumn() {
        savePlan(901L, MONGSIL);

        List<PlanEntity> found = planRepository.findMyPlansWithPet(MEMBER_ID, MONGSIL, Long.MAX_VALUE, FIRST_PAGE).getContent();

        assertThat(found).extracting(PlanEntity::getId).containsExactly(901L);
    }

    @Test
    @DisplayName("대표 컬럼과 조인 테이블에 같은 반려견이 있어도 일정은 한 번만 나온다")
    void doesNotDuplicateWhenBothSourcesMatch() {
        savePlan(901L, MONGSIL);
        savePlanPets(901L, MONGSIL, BORI);

        List<PlanEntity> found = planRepository.findMyPlansWithPet(MEMBER_ID, MONGSIL, Long.MAX_VALUE, FIRST_PAGE).getContent();

        assertThat(found).hasSize(1);
    }

    @Test
    @DisplayName("동행하지 않은 반려견·삭제된 일정·남의 일정·커서 밖은 빠지고, id 내림차순이다")
    void filtersAndOrders() {
        savePlan(901L, MONGSIL);                 // 몽실이만
        savePlanPets(901L, MONGSIL);
        savePlan(902L, MONGSIL);                 // 몽실이 + 보리
        savePlanPets(902L, MONGSIL, BORI);
        savePlan(903L, BORI);                    // 보리만 (옛 일정)
        PlanEntity deleted = plan(904L, MEMBER_ID, BORI, true);   // 삭제됨
        planRepository.save(deleted);
        planRepository.save(plan(905L, 99L, BORI, false));       // 남의 일정
        savePlan(906L, BORI);                    // 커서 밖

        List<PlanEntity> found = planRepository.findMyPlansWithPet(MEMBER_ID, BORI, 906L, FIRST_PAGE).getContent();

        assertThat(found).extracting(PlanEntity::getId).containsExactly(903L, 902L);
    }

    private void savePlan(long planId, long petId) {
        planRepository.save(plan(planId, MEMBER_ID, petId, false));
    }

    private void savePlanPets(long planId, long... petIds) {
        long id = planId * 10;
        for (long petId : petIds) {
            planPetRepository.save(PlanPetEntity.builder().id(id++).planId(planId).petId(petId).build());
        }
    }

    private static PlanEntity plan(long id, long memberId, long petId, boolean deleted) {
        return PlanEntity.builder()
            .id(id).memberId(memberId).petId(petId).areaCode("39").title("일정 " + id)
            .startDate(LocalDate.of(2026, 9, 12)).endDate(LocalDate.of(2026, 9, 14))
            .status(PlanStatus.DRAFT).deleted(deleted)
            .build();
    }
}
