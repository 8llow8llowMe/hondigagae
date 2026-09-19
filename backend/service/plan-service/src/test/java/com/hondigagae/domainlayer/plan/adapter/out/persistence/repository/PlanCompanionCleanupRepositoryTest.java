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
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

/**
 * 동행견 대사 배치가 쓰는 JPQL 검증 (#720) — 컴파일로 검증되지 않아 실제 스키마에 질의해 본다.
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>완료 일정은 아예 안 잡힌다</b> — 배치가 다녀온 기록을 건드리지 않는 첫 번째 방어선이다</li>
 *   <li><b>한 마리라도 동행이면 히트</b> — 조인 테이블과 대표 컬럼을 함께 본다 (옛 일정 포함)</li>
 *   <li>{@code plan_pet} 한 행만 지우는 벌크 DML 이 같은 일정의 다른 아이를 건드리지 않는다</li>
 * </ul>
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
class PlanCompanionCleanupRepositoryTest {

    @SpringBootConfiguration
    @EnableJpaRepositories(basePackages = "com.hondigagae.domainlayer")
    static class SliceConfig {
    }

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 99L;
    private static final long MONGSIL = 2L;
    private static final long BORI = 5L;
    private static final List<PlanStatus> EDITABLE = PlanStatus.companionEditableStatuses();

    @Autowired
    private PlanRepository planRepository;

    @Autowired
    private PlanPetRepository planPetRepository;

    /** 벌크 DML 은 영속성 컨텍스트를 우회한다 — 비우고 다시 읽어야 실제 저장된 값을 본다. */
    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("정리 대상은 미완료·미삭제 일정뿐이고, 조인 테이블과 대표 컬럼 어느 쪽으로 실려 있어도 잡힌다")
    void findsEveryEditablePlanCarryingThePet() {
        savePlan(901L, MEMBER_ID, MONGSIL, PlanStatus.DRAFT, false);
        savePlanPets(901L, MONGSIL, BORI);                                  // 조인 테이블로 히트
        savePlan(902L, MEMBER_ID, BORI, PlanStatus.CONFIRMED, false);       // 대표 컬럼으로 히트 (옛 일정)
        savePlan(903L, MEMBER_ID, BORI, PlanStatus.COMPLETED, false);       // 완료 - 불가침
        savePlanPets(903L, BORI);
        savePlan(904L, MEMBER_ID, BORI, PlanStatus.DRAFT, true);            // 삭제됨
        savePlan(905L, OTHER_MEMBER_ID, BORI, PlanStatus.DRAFT, false);     // 남의 일정

        List<PlanEntity> found = planRepository.findCompanionEditablePlansWithPet(MEMBER_ID, BORI, EDITABLE);

        assertThat(found).extracting(PlanEntity::getId).containsExactly(901L, 902L);
    }

    @Test
    @DisplayName("대표 컬럼과 조인 테이블에 같은 반려견이 있어도 일정은 한 번만 나온다")
    void doesNotDuplicateWhenBothSourcesMatch() {
        savePlan(901L, MEMBER_ID, MONGSIL, PlanStatus.DRAFT, false);
        savePlanPets(901L, MONGSIL, BORI);

        List<PlanEntity> found = planRepository.findCompanionEditablePlansWithPet(MEMBER_ID, MONGSIL, EDITABLE);

        assertThat(found).hasSize(1);
    }

    @Test
    @DisplayName("회원의 정리 대상 일정 전부 — 완료·삭제·남의 일정은 빠지고 id 오름차순이다")
    void findsEveryEditablePlanOfTheMember() {
        savePlan(903L, MEMBER_ID, MONGSIL, PlanStatus.CONFIRMED, false);
        savePlan(901L, MEMBER_ID, BORI, PlanStatus.DRAFT, false);
        savePlan(902L, MEMBER_ID, BORI, PlanStatus.COMPLETED, false);
        savePlan(904L, MEMBER_ID, BORI, PlanStatus.DRAFT, true);
        savePlan(905L, OTHER_MEMBER_ID, BORI, PlanStatus.DRAFT, false);

        List<PlanEntity> found = planRepository.findCompanionEditablePlans(MEMBER_ID, EDITABLE);

        assertThat(found).extracting(PlanEntity::getId).containsExactly(901L, 903L);
    }

    @Test
    @DisplayName("회원 아이디는 중복 없이 오름차순으로, 커서 뒤부터 페이지 크기만큼 나온다")
    void pagesMemberIdsWithACursor() {
        savePlan(901L, 10L, MONGSIL, PlanStatus.DRAFT, false);
        savePlan(902L, 10L, BORI, PlanStatus.CONFIRMED, false);   // 같은 회원의 두 번째 일정
        savePlan(903L, 20L, MONGSIL, PlanStatus.DRAFT, false);
        savePlan(904L, 30L, MONGSIL, PlanStatus.COMPLETED, false);   // 완료만 있는 회원은 빠진다
        savePlan(905L, 40L, MONGSIL, PlanStatus.DRAFT, false);

        List<Long> firstPage = planRepository.findMemberIdsWithCompanionEditablePlans(0L, EDITABLE, PageRequest.of(0, 2));
        List<Long> secondPage = planRepository.findMemberIdsWithCompanionEditablePlans(
            firstPage.get(firstPage.size() - 1), EDITABLE, PageRequest.of(0, 2));

        assertThat(firstPage).containsExactly(10L, 20L);
        assertThat(secondPage).containsExactly(40L);
    }

    @Test
    @DisplayName("동행견 한 마리만 지운다 — 같은 일정의 다른 아이와 다른 일정의 같은 아이는 남는다")
    void deletesOnlyTheRequestedCompanionRow() {
        savePlanPets(901L, MONGSIL, BORI);
        savePlanPets(902L, BORI);

        int deleted = planPetRepository.deleteByPlanIdAndPetId(901L, BORI);

        assertThat(deleted).isEqualTo(1);
        assertThat(planPetRepository.findByPlanIdOrderByIdAsc(901L)).extracting(PlanPetEntity::getPetId).containsExactly(MONGSIL);
        assertThat(planPetRepository.findByPlanIdOrderByIdAsc(902L)).extracting(PlanPetEntity::getPetId).containsExactly(BORI);
    }

    @Test
    @DisplayName("이미 떼어낸 뒤에 다시 지우면 0건이다 — 배치 재실행이 멱등인 근거")
    void deletingTwiceIsIdempotent() {
        savePlanPets(901L, MONGSIL, BORI);

        assertThat(planPetRepository.deleteByPlanIdAndPetId(901L, BORI)).isEqualTo(1);
        assertThat(planPetRepository.deleteByPlanIdAndPetId(901L, BORI)).isZero();
    }

    @Test
    @DisplayName("잠금 재조회는 살아 있는 일정만 돌려준다 — 삭제된 일정은 잠글 것도 없다")
    void lockingReloadSeesOnlyLivePlans() {
        savePlan(901L, MEMBER_ID, MONGSIL, PlanStatus.DRAFT, false);
        savePlan(902L, MEMBER_ID, MONGSIL, PlanStatus.DRAFT, true);

        assertThat(planRepository.findActiveByIdForUpdate(901L)).isPresent();
        assertThat(planRepository.findActiveByIdForUpdate(902L)).isEmpty();
    }

    @Test
    @DisplayName("동행견 잠금 조회도 저장 순서(id 오름차순)를 지킨다 — 첫 행이 곧 대표다")
    void lockingCompanionReadKeepsInsertionOrder() {
        savePlanPets(901L, BORI, MONGSIL);
        savePlanPets(902L, MONGSIL);

        List<PlanPetEntity> locked = planPetRepository.findByPlanIdOrderByIdAscForUpdate(901L);

        assertThat(locked).extracting(PlanPetEntity::getPetId).containsExactly(BORI, MONGSIL);
        // 옛 일정(조인 테이블 행 없음)은 잠글 행이 없어 빈 목록이다 — 예외가 아니다.
        assertThat(planPetRepository.findByPlanIdOrderByIdAscForUpdate(903L)).isEmpty();
    }

    @Test
    @DisplayName("대표 승계는 pet_id 한 컬럼만 바꾼다 — 배치가 제목·기간·예산을 되돌리지 않는다")
    void promotionTouchesOnlyTheRepresentativeColumn() {
        // 배치가 대상 목록을 만든 뒤 사용자가 일정을 고친 상황을 만들어 둔다.
        planRepository.save(PlanEntity.builder()
            .id(901L).memberId(MEMBER_ID).petId(MONGSIL).areaCode("39").title("사용자가 고친 제목")
            .startDate(LocalDate.of(2026, 10, 1)).endDate(LocalDate.of(2026, 10, 5))
            .budget(500_000).status(PlanStatus.CONFIRMED).deleted(false)
            .build());

        int promoted = planRepository.promoteRepresentative(901L, BORI, MONGSIL);
        entityManager.flush();
        entityManager.clear();

        PlanEntity found = planRepository.findById(901L).orElseThrow();
        assertThat(promoted).isEqualTo(1);
        assertThat(found.getPetId()).isEqualTo(BORI);
        // 나머지 컬럼은 그대로다. 일정 전체를 save 하던 방식이라면 낡은 스냅샷이 여기를 덮어쓴다.
        assertThat(found.getTitle()).isEqualTo("사용자가 고친 제목");
        assertThat(found.getStartDate()).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(found.getEndDate()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(found.getBudget()).isEqualTo(500_000);
        assertThat(found.getStatus()).isEqualTo(PlanStatus.CONFIRMED);
    }

    @Test
    @DisplayName("그 사이 대표가 바뀌었으면 0건을 돌려주고 아무것도 바꾸지 않는다")
    void promotionDoesNothingWhenTheRepresentativeChangedMeanwhile() {
        savePlan(901L, MEMBER_ID, MONGSIL, PlanStatus.DRAFT, false);

        int promoted = planRepository.promoteRepresentative(901L, BORI, 12_345L);
        entityManager.flush();
        entityManager.clear();

        assertThat(promoted).isZero();
        assertThat(planRepository.findById(901L).orElseThrow().getPetId()).isEqualTo(MONGSIL);
    }

    private void savePlan(long planId, long memberId, long petId, PlanStatus status, boolean deleted) {
        planRepository.save(PlanEntity.builder()
            .id(planId).memberId(memberId).petId(petId).areaCode("39").title("일정 " + planId)
            .startDate(LocalDate.of(2026, 9, 12)).endDate(LocalDate.of(2026, 9, 14))
            .status(status).deleted(deleted)
            .build());
    }

    /** 인자 순서 = 저장 순서. id 오름차순이 곧 저장 순서라는 전제를 픽스처가 그대로 흉내 낸다. */
    private void savePlanPets(long planId, long... petIds) {
        long rowId = planId * 10;
        for (long petId : petIds) {
            planPetRepository.save(PlanPetEntity.builder().id(rowId++).planId(planId).petId(petId).build());
        }
    }
}
