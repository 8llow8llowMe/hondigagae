package com.hondigagae.domainlayer.pet.application.port.in;

import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetsResponse;
import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;

public interface PetWebUseCase {

    PetsResponse getMyPets(long memberId);

    PetResponse getMyPet(long memberId, long petId);

    PetResponse registerPet(long memberId, PetSaveCommand command);

    PetResponse updatePet(long memberId, long petId, PetSaveCommand command);

    void deletePet(long memberId, long petId);
}
