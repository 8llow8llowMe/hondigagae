package com.hondigagae.domainlayer.pet.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;
import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import com.hondigagae.domainlayer.pet.application.info.PetProfileImageChangeResult;
import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PetCommandProcessorTest {

    private static final long OWNER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final long PET_ID = 10L;

    private StubPetRepositoryPort petRepositoryPort;
    private PetCommandProcessor processor;

    @BeforeEach
    void setUp() {
        petRepositoryPort = new StubPetRepositoryPort();
        processor = new PetCommandProcessor(
            new PetQueryProcessor(petRepositoryPort), petRepositoryPort, new SnowflakeIdGenerator(0, 0));

        petRepositoryPort.register(pet(PET_ID, OWNER_ID, "pets/profiles/1/2026/08/old.png"));
    }

    @Test
    void updateProfileImage_replacesKeyAndReturnsPreviousKey() {
        PetProfileImageChangeResult result =
            processor.updateProfileImage(OWNER_ID, PET_ID, "pets/profiles/1/2026/08/new.png");

        // 호출부(파사드)가 이전 파일을 삭제할 수 있도록 교체 전 키를 돌려준다
        assertThat(result.previousObjectKey()).isEqualTo("pets/profiles/1/2026/08/old.png");
        assertThat(result.petInfo().profileImageKey()).isEqualTo("pets/profiles/1/2026/08/new.png");
        assertThat(petRepositoryPort.findById(PET_ID).orElseThrow().profileImageKey())
            .isEqualTo("pets/profiles/1/2026/08/new.png");
    }

    @Test
    void updateProfileImage_notOwner_rejectsWithNotFound() {
        // 소유자가 다르면 존재 자체를 노출하지 않도록 404(NOT_FOUND_PET)로 거부한다
        assertThatThrownBy(() ->
            processor.updateProfileImage(OTHER_MEMBER_ID, PET_ID, "pets/profiles/2/2026/08/new.png"))
            .isInstanceOf(PetException.class)
            .extracting(exception -> ((PetException) exception).getErrorCode())
            .isEqualTo(PetErrorCode.NOT_FOUND_PET);
        assertThat(petRepositoryPort.findById(PET_ID).orElseThrow().profileImageKey())
            .isEqualTo("pets/profiles/1/2026/08/old.png");
    }

    @Test
    void removeProfileImage_clearsKeyAndReturnsPreviousKey() {
        PetProfileImageChangeResult result = processor.removeProfileImage(OWNER_ID, PET_ID);

        assertThat(result.previousObjectKey()).isEqualTo("pets/profiles/1/2026/08/old.png");
        assertThat(result.petInfo().profileImageKey()).isNull();
        assertThat(petRepositoryPort.findById(PET_ID).orElseThrow().profileImageKey()).isNull();
    }

    @Test
    void update_keepsProfileImageKey() {
        // 일반 프로필 수정이 이미지 키를 지우면 안 된다 (별도 API 로만 변경)
        Pet pet = petRepositoryPort.findById(PET_ID).orElseThrow();
        Pet updated = pet.update(
            "새이름", pet.breed(), pet.birthYm(), pet.sizeType(), pet.weightKg(),
            pet.heatSensitive(), pet.coldSensitive(), pet.noiseSensitive(),
            pet.activityLevel(), pet.walkPreferred(), pet.sociality());

        assertThat(updated.profileImageKey()).isEqualTo("pets/profiles/1/2026/08/old.png");
        assertThat(pet.delete().profileImageKey()).isEqualTo("pets/profiles/1/2026/08/old.png");
    }

    @Test
    void register_firstPetBecomesRepresentative() {
        long newMemberId = 99L;

        PetInfo first = processor.register(newMemberId, saveCommand("첫째"));
        PetInfo second = processor.register(newMemberId, saveCommand("둘째"));

        // 첫 반려견만 자동으로 대표가 된다
        assertThat(first.representative()).isTrue();
        assertThat(second.representative()).isFalse();
    }

    @Test
    void markRepresentative_switchesAndKeepsSingleRepresentative() {
        PetInfo first = processor.register(OWNER_ID, saveCommand("첫째"));
        processor.markRepresentative(OWNER_ID, first.petId());

        PetInfo second = processor.register(OWNER_ID, saveCommand("둘째"));
        processor.markRepresentative(OWNER_ID, second.petId());

        // 대표는 항상 한 마리만
        List<Pet> pets = petRepositoryPort.findAllByMemberId(OWNER_ID);
        assertThat(pets.stream().filter(Pet::representative).count()).isEqualTo(1);
        assertThat(petRepositoryPort.findById(second.petId()).orElseThrow().representative()).isTrue();
    }

    @Test
    void delete_representative_promotesOldestRemaining() {
        PetInfo first = processor.register(OWNER_ID, saveCommand("첫째"));
        PetInfo second = processor.register(OWNER_ID, saveCommand("둘째"));
        processor.markRepresentative(OWNER_ID, first.petId());

        processor.delete(OWNER_ID, first.petId());

        // 대표견 삭제 시 가장 먼저 등록된 남은 반려견이 대표로 승계된다
        List<Pet> remaining = petRepositoryPort.findAllByMemberId(OWNER_ID);
        assertThat(remaining.stream().filter(Pet::representative).count()).isEqualTo(1);
        long oldestRemainingId = remaining.get(0).id();
        assertThat(petRepositoryPort.findById(oldestRemainingId).orElseThrow().representative()).isTrue();
        assertThat(petRepositoryPort.findById(second.petId()).orElseThrow()).isNotNull();
    }

    @Test
    void register_weightContradictsSizeType_rejected() {
        // 30kg 소형견이 저장되면 적합도 판정이 "소형견만 가능" 장소를 동반 가능으로 읽는다 (#364)
        assertThatThrownBy(() ->
            processor.register(OWNER_ID, saveCommand("모순이", PetSizeType.SMALL, new BigDecimal("30.0"))))
            .isInstanceOf(PetException.class)
            .extracting(exception -> ((PetException) exception).getErrorCode())
            .isEqualTo(PetErrorCode.WEIGHT_SIZE_MISMATCH);
    }

    @Test
    void register_weightOnBoundary_followsEnumDefinition() {
        // 경계는 PetSizeType 설명("10kg 미만" / "25kg 이상")과 같아야 한다 - 10.0 은 중형, 25.0 은 대형이다
        assertThat(processor.register(OWNER_ID, saveCommand("소형", PetSizeType.SMALL, new BigDecimal("9.9"))))
            .isNotNull();
        assertThat(processor.register(OWNER_ID, saveCommand("중형", PetSizeType.MEDIUM, new BigDecimal("10.0"))))
            .isNotNull();
        assertThat(processor.register(OWNER_ID, saveCommand("대형", PetSizeType.LARGE, new BigDecimal("25.0"))))
            .isNotNull();

        assertThatThrownBy(() ->
            processor.register(OWNER_ID, saveCommand("경계", PetSizeType.SMALL, new BigDecimal("10.0"))))
            .isInstanceOf(PetException.class)
            .extracting(exception -> ((PetException) exception).getErrorCode())
            .isEqualTo(PetErrorCode.WEIGHT_SIZE_MISMATCH);
    }

    @Test
    void register_withoutWeight_skipsCrossValidation() {
        // 체중은 선택 입력이다 - 없는 값으로 크기를 의심하지 않는다 (기존 saveCommand 가 체중 없음)
        assertThat(processor.register(OWNER_ID, saveCommand("무게모름"))).isNotNull();
    }

    @Test
    void update_weightContradictsSizeType_rejected() {
        PetInfo saved = processor.register(OWNER_ID, saveCommand("첫째"));

        assertThatThrownBy(() ->
            processor.update(OWNER_ID, saved.petId(), saveCommand("첫째", PetSizeType.LARGE, new BigDecimal("3.8"))))
            .isInstanceOf(PetException.class)
            .extracting(exception -> ((PetException) exception).getErrorCode())
            .isEqualTo(PetErrorCode.WEIGHT_SIZE_MISMATCH);
        // 거부된 수정은 저장되지 않는다
        assertThat(petRepositoryPort.findById(saved.petId()).orElseThrow().sizeType())
            .isEqualTo(PetSizeType.SMALL);
    }

    private static PetSaveCommand saveCommand(String name) {
        return saveCommand(name, PetSizeType.SMALL, null);
    }

    private static PetSaveCommand saveCommand(String name, PetSizeType sizeType, BigDecimal weightKg) {
        return PetSaveCommand.builder()
            .name(name)
            .sizeType(sizeType)
            .weightKg(weightKg)
            .activityLevel(ActivityLevel.MEDIUM)
            .sociality(SocialityLevel.MEDIUM)
            .build();
    }

    private static Pet pet(long id, long memberId, String profileImageKey) {
        return Pet.builder()
            .id(id)
            .memberId(memberId)
            .name("몽실이")
            .breed("말티즈")
            .birthYm("2017-05")
            .sizeType(PetSizeType.SMALL)
            .heatSensitive(true)
            .coldSensitive(false)
            .noiseSensitive(false)
            .activityLevel(ActivityLevel.MEDIUM)
            .walkPreferred(true)
            .sociality(SocialityLevel.MEDIUM)
            .profileImageKey(profileImageKey)
            .deleted(false)
            .build();
    }

    private static class StubPetRepositoryPort implements PetRepositoryPort {

        private final Map<Long, Pet> store = new HashMap<>();

        void register(Pet pet) {
            store.put(pet.id(), pet);
        }

        @Override
        public Pet save(Pet domain) {
            store.put(domain.id(), domain);
            return domain;
        }

        @Override
        public List<Pet> findAllByMemberId(long memberId) {
            return store.values().stream()
                .filter(pet -> pet.memberId() == memberId && !pet.deleted())
                .sorted(java.util.Comparator.comparingLong(Pet::id))
                .toList();
        }

        @Override
        public Optional<Pet> findById(long petId) {
            return Optional.ofNullable(store.get(petId))
                .filter(pet -> !pet.deleted());
        }

        @Override
        public long countByMemberId(long memberId) {
            return findAllByMemberId(memberId).size();
        }

        @Override
        public Optional<Pet> findRepresentativeByMemberId(long memberId) {
            return findAllByMemberId(memberId).stream().filter(Pet::representative).findFirst();
        }
    
        @Override
        public List<String> findAllProfileImageKeys() {
            return store.values().stream()
                .map(Pet::profileImageKey)
                .filter(java.util.Objects::nonNull)
                .toList();
        }
    }
}
