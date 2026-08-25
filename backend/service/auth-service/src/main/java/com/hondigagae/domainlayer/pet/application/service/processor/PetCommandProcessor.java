package com.hondigagae.domainlayer.pet.application.service.processor;

import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;
import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
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
        if (petRepositoryPort.countByMemberId(memberId) >= MAX_PET_COUNT) {
            throw new PetException(PetErrorCode.PET_LIMIT_EXCEEDED);
        }

        Pet pet = Pet.builder()
            .id(snowflakeIdGenerator.generateId())
            .memberId(memberId)
            .name(command.name())
            .breed(command.breed())
            .birthYm(command.birthYm())
            .sizeType(command.sizeType())
            .heatSensitive(command.heatSensitive())
            .coldSensitive(command.coldSensitive())
            .noiseSensitive(command.noiseSensitive())
            .activityLevel(command.activityLevel())
            .walkPreferred(command.walkPreferred())
            .sociality(command.sociality())
            .deleted(false)
            .build();

        return PetInfo.from(petRepositoryPort.save(pet));
    }

    public PetInfo update(long memberId, long petId, PetSaveCommand command) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        Pet updated = pet.update(
            command.name(), command.breed(), command.birthYm(), command.sizeType(),
            command.heatSensitive(), command.coldSensitive(), command.noiseSensitive(),
            command.activityLevel(), command.walkPreferred(), command.sociality()
        );
        return PetInfo.from(petRepositoryPort.save(updated));
    }

    public void delete(long memberId, long petId) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        petRepositoryPort.save(pet.delete());
    }
}
