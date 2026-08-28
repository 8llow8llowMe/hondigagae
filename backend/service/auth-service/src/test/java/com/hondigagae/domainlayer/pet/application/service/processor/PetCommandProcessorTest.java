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

    private static PetSaveCommand saveCommand(String name) {
        return PetSaveCommand.builder()
            .name(name)
            .sizeType(PetSizeType.SMALL)
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
    }
}
