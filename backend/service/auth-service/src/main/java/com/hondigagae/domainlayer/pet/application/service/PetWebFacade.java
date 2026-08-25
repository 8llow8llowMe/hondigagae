package com.hondigagae.domainlayer.pet.application.service;

import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetsResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.presenter.PetPresenter;
import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.application.port.in.PetWebUseCase;
import com.hondigagae.domainlayer.pet.application.service.processor.PetCommandProcessor;
import com.hondigagae.domainlayer.pet.application.service.processor.PetQueryProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PetWebFacade implements PetWebUseCase {

    private final PetQueryProcessor petQueryProcessor;
    private final PetCommandProcessor petCommandProcessor;
    private final PetPresenter petPresenter;

    @Override
    @Transactional(readOnly = true)
    public PetsResponse getMyPets(long memberId) {
        List<PetInfo> petInfos = petQueryProcessor.getMyPets(memberId);
        return petPresenter.toPetsResponse(petInfos);
    }

    @Override
    @Transactional(readOnly = true)
    public PetResponse getMyPet(long memberId, long petId) {
        PetInfo petInfo = petQueryProcessor.getMyPet(memberId, petId);
        return petPresenter.toPetResponse(petInfo);
    }

    @Override
    @Transactional
    public PetResponse registerPet(long memberId, PetSaveCommand command) {
        PetInfo petInfo = petCommandProcessor.register(memberId, command);
        return petPresenter.toPetResponse(petInfo);
    }

    @Override
    @Transactional
    public PetResponse updatePet(long memberId, long petId, PetSaveCommand command) {
        PetInfo petInfo = petCommandProcessor.update(memberId, petId, command);
        return petPresenter.toPetResponse(petInfo);
    }

    @Override
    @Transactional
    public void deletePet(long memberId, long petId) {
        petCommandProcessor.delete(memberId, petId);
    }
}
