package com.hondigagae.domainlayer.pet.application.service.processor;

import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PetQueryProcessor {

    private final PetRepositoryPort petRepositoryPort;

    public List<PetInfo> getMyPets(long memberId) {
        return petRepositoryPort.findAllByMemberId(memberId).stream()
            .map(PetInfo::from)
            .toList();
    }

    public PetInfo getMyPet(long memberId, long petId) {
        return PetInfo.from(getOwnedPet(memberId, petId));
    }

    /**
     * 본인 소유 반려견만 통과시킨다. 소유자가 다르면 존재 자체를 노출하지 않도록
     * 403이 아니라 404(NOT_FOUND_PET)로 응답한다.
     */
    public Pet getOwnedPet(long memberId, long petId) {
        Pet pet = petRepositoryPort.findById(petId)
            .orElseThrow(() -> new PetException(PetErrorCode.NOT_FOUND_PET));

        if (!pet.isOwnedBy(memberId)) {
            throw new PetException(PetErrorCode.NOT_FOUND_PET);
        }
        return pet;
    }
}
