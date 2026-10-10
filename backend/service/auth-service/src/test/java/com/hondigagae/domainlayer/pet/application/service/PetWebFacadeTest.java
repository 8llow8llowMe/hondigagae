package com.hondigagae.domainlayer.pet.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import com.hondigagae.domainlayer.pet.application.port.out.PlanCompanionCommandPort;
import com.hondigagae.domainlayer.pet.application.service.processor.PetCommandProcessor;
import com.hondigagae.domainlayer.pet.application.service.processor.PetQueryProcessor;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

/**
 * 반려견 삭제 뒤 plan-service 동행 목록 대사 요청 (#972).
 *
 * <p>고정하는 것은 넷이다.
 * <ul>
 *   <li>대사 요청은 삭제가 <b>반영된 뒤</b>에 간다 — plan 이 auth 에 되물었을 때 방금 지운 아이가 없어야 한다</li>
 *   <li>그 "반영" 이 곧 커밋이 되도록 파사드는 트랜잭션을 열지 않고 {@code PetCommandProcessor.delete} 가 연다</li>
 *   <li>남의 반려견이면(PET_001) 요청하지 않는다</li>
 *   <li>포트가 아무것도 못 해도 삭제는 성공한다</li>
 * </ul>
 */
class PetWebFacadeTest {

    private static final long OWNER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final long PET_ID = 10L;
    private static final long SECOND_PET_ID = 11L;

    private StubPetRepositoryPort petRepositoryPort;
    private RecordingPlanCompanionCommandPort planCompanionCommandPort;
    private PetWebFacade facade;

    @BeforeEach
    void setUp() {
        petRepositoryPort = new StubPetRepositoryPort();
        planCompanionCommandPort = new RecordingPlanCompanionCommandPort(petRepositoryPort);
        PetQueryProcessor petQueryProcessor = new PetQueryProcessor(petRepositoryPort);
        PetCommandProcessor petCommandProcessor = new PetCommandProcessor(
            petQueryProcessor, petRepositoryPort, new SnowflakeIdGenerator(0, 0));
        // 삭제 경로는 응답 변환·스토리지를 쓰지 않는다.
        facade = new PetWebFacade(petQueryProcessor, petCommandProcessor, null, null, planCompanionCommandPort);

        petRepositoryPort.save(pet(PET_ID, OWNER_ID, true));
        petRepositoryPort.save(pet(SECOND_PET_ID, OWNER_ID, false));
    }

    @Test
    @DisplayName("삭제(대표 승계 포함)가 반영된 뒤에 plan-service 대사를 한 번 요청한다")
    void requestsReconcileAfterTheDeletionIsApplied() {
        facade.deletePet(OWNER_ID, PET_ID);

        assertThat(planCompanionCommandPort.calls).containsExactly(new Call(OWNER_ID, PET_ID, true, SECOND_PET_ID));
    }

    @Test
    @DisplayName("파사드는 트랜잭션을 열지 않고 삭제 DB 구간만 트랜잭션이다 — 요청이 커밋 뒤에 가는 근거")
    void onlyTheDatabaseSectionIsTransactional() throws NoSuchMethodException {
        Method facadeMethod = PetWebFacade.class.getMethod("deletePet", long.class, long.class);
        Method processorMethod = PetCommandProcessor.class.getMethod("delete", long.class, long.class);

        assertThat(facadeMethod.isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(PetWebFacade.class.isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(processorMethod.isAnnotationPresent(Transactional.class)).isTrue();
    }

    @Test
    @DisplayName("남의 반려견이면 PET_001 이고 plan-service 에 요청하지 않는다")
    void doesNotRequestReconcileWhenThePetIsNotOwned() {
        assertThatThrownBy(() -> facade.deletePet(OTHER_MEMBER_ID, PET_ID))
            .isInstanceOf(PetException.class)
            .extracting(exception -> ((PetException) exception).getErrorCode())
            .isEqualTo(PetErrorCode.NOT_FOUND_PET);

        assertThat(planCompanionCommandPort.calls).isEmpty();
        assertThat(petRepositoryPort.findById(PET_ID)).isPresent();
    }

    @Test
    @DisplayName("포트가 아무것도 하지 않아도(plan 실패를 삼킨 경우) 삭제는 그대로 성공한다")
    void deletionSucceedsEvenWhenTheReconcileRequestDoesNothing() {
        PetQueryProcessor petQueryProcessor = new PetQueryProcessor(petRepositoryPort);
        PetWebFacade silentFacade = new PetWebFacade(petQueryProcessor,
            new PetCommandProcessor(petQueryProcessor, petRepositoryPort, new SnowflakeIdGenerator(0, 0)), null, null,
            (memberId, deletedPetId) -> { });

        silentFacade.deletePet(OWNER_ID, PET_ID);

        assertThat(petRepositoryPort.findById(PET_ID)).isEmpty();
        assertThat(petRepositoryPort.findById(SECOND_PET_ID)).map(Pet::representative).contains(true);
    }

    private static Pet pet(long id, long memberId, boolean representative) {
        return Pet.builder()
            .id(id)
            .memberId(memberId)
            .name("몽실이" + id)
            .breed("말티즈")
            .birthYm("2017-05")
            .sizeType(PetSizeType.SMALL)
            .heatSensitive(true)
            .coldSensitive(false)
            .noiseSensitive(false)
            .activityLevel(ActivityLevel.MEDIUM)
            .walkPreferred(true)
            .sociality(SocialityLevel.MEDIUM)
            .representative(representative)
            .deleted(false)
            .build();
    }

    /**
     * @param petGoneAtCall     호출 시점에 지운 반려견이 저장소에서 이미 사라졌는가
     * @param representativeId  호출 시점의 대표 반려견 — 대표 승계까지 끝난 뒤인지 본다
     */
    private record Call(long memberId, long deletedPetId, boolean petGoneAtCall, Long representativeId) {
    }

    /** 호출 시점의 저장소 상태를 함께 기록한다 — "삭제가 반영된 뒤에 불렸는가" 를 그 자리에서 본다. */
    private static final class RecordingPlanCompanionCommandPort implements PlanCompanionCommandPort {

        private final StubPetRepositoryPort petRepositoryPort;
        private final List<Call> calls = new ArrayList<>();

        private RecordingPlanCompanionCommandPort(StubPetRepositoryPort petRepositoryPort) {
            this.petRepositoryPort = petRepositoryPort;
        }

        @Override
        public void reconcileCompanions(long memberId, long deletedPetId) {
            calls.add(new Call(memberId, deletedPetId, petRepositoryPort.findById(deletedPetId).isEmpty(),
                petRepositoryPort.findRepresentativeByMemberId(memberId).map(Pet::id).orElse(null)));
        }
    }

    private static final class StubPetRepositoryPort implements PetRepositoryPort {

        private final Map<Long, Pet> store = new HashMap<>();

        @Override
        public Pet save(Pet domain) {
            store.put(domain.id(), domain);
            return domain;
        }

        @Override
        public List<Pet> findAllByMemberId(long memberId) {
            return store.values().stream()
                .filter(pet -> pet.memberId() == memberId && !pet.deleted())
                .sorted(Comparator.comparingLong(Pet::id))
                .toList();
        }

        @Override
        public Optional<Pet> findById(long petId) {
            return Optional.ofNullable(store.get(petId)).filter(pet -> !pet.deleted());
        }

        @Override
        public long countByMemberId(long memberId) {
            return findAllByMemberId(memberId).size();
        }

        @Override
        public List<String> findAllProfileImageKeys() {
            return store.values().stream().map(Pet::profileImageKey).filter(Objects::nonNull).toList();
        }

        @Override
        public Optional<Pet> findRepresentativeByMemberId(long memberId) {
            return findAllByMemberId(memberId).stream().filter(Pet::representative).findFirst();
        }

        @Override
        public void deleteAllByMemberIdIn(List<Long> memberIds) {
            throw new UnsupportedOperationException();
        }
    }
}
