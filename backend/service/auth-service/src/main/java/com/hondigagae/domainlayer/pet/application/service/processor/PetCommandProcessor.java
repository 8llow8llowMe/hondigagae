package com.hondigagae.domainlayer.pet.application.service.processor;

import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;
import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.application.info.PetProfileImageChangeResult;
import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PetCommandProcessor {

    /** 한 회원이 등록할 수 있는 반려견 수. 개인 사용자 기준으로 충분한 상한이다. */
    private static final long MAX_PET_COUNT = 5L;

    private final PetQueryProcessor petQueryProcessor;
    private final PetRepositoryPort petRepositoryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public PetInfo register(long memberId, PetSaveCommand command) {
        long petCount = petRepositoryPort.countByMemberId(memberId);
        if (petCount >= MAX_PET_COUNT) {
            throw new PetException(PetErrorCode.PET_LIMIT_EXCEEDED);
        }

        Pet pet = Pet.builder()
            .id(snowflakeIdGenerator.generateId())
            .memberId(memberId)
            .name(command.name())
            .breed(command.breed())
            .birthYm(command.birthYm())
            .sizeType(command.sizeType())
            .weightKg(command.weightKg())
            .heatSensitive(command.heatSensitive())
            .coldSensitive(command.coldSensitive())
            .noiseSensitive(command.noiseSensitive())
            .activityLevel(command.activityLevel())
            .walkPreferred(command.walkPreferred())
            .sociality(command.sociality())
            // 첫 반려견은 자동으로 대표가 된다 - 한 마리만 키우는 사용자가 대표 지정을 모르고 지나가도 AI 기본값이 동작한다
            .representative(petCount == 0)
            .deleted(false)
            .build();

        return PetInfo.from(petRepositoryPort.save(pet));
    }

    public PetInfo update(long memberId, long petId, PetSaveCommand command) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        Pet updated = pet.update(
            command.name(), command.breed(), command.birthYm(), command.sizeType(), command.weightKg(),
            command.heatSensitive(), command.coldSensitive(), command.noiseSensitive(),
            command.activityLevel(), command.walkPreferred(), command.sociality()
        );
        return PetInfo.from(petRepositoryPort.save(updated));
    }

    public PetProfileImageChangeResult updateProfileImage(long memberId, long petId, String objectKey) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        String previousObjectKey = pet.profileImageKey();
        Pet updated = petRepositoryPort.save(pet.updateProfileImageKey(objectKey));
        return new PetProfileImageChangeResult(PetInfo.from(updated), previousObjectKey);
    }

    public PetProfileImageChangeResult removeProfileImage(long memberId, long petId) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        String previousObjectKey = pet.profileImageKey();
        Pet updated = petRepositoryPort.save(pet.removeProfileImage());
        return new PetProfileImageChangeResult(PetInfo.from(updated), previousObjectKey);
    }

    public void delete(long memberId, long petId) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        petRepositoryPort.save(pet.delete());

        // 대표견을 지웠으면 가장 먼저 등록한 남은 반려견을 대표로 올린다 -
        // "대표 없음" 상태를 만들지 않아 AI 기본값이 항상 동작하게 한다.
        if (pet.representative()) {
            petRepositoryPort.findAllByMemberId(memberId).stream()
                .filter(remaining -> remaining.id() != petId)
                .findFirst()
                .ifPresent(remaining -> petRepositoryPort.save(remaining.markRepresentative()));
        }
    }

    /** 대표 반려견 지정. 기존 대표는 해제해 회원당 하나만 유지한다. */
    public PetInfo markRepresentative(long memberId, long petId) {
        Pet target = petQueryProcessor.getOwnedPet(memberId, petId);
        petRepositoryPort.findAllByMemberId(memberId).stream()
            .filter(Pet::representative)
            .filter(pet -> pet.id() != petId)
            .forEach(pet -> petRepositoryPort.save(pet.clearRepresentative()));
        return PetInfo.from(petRepositoryPort.save(target.markRepresentative()));
    }
}
