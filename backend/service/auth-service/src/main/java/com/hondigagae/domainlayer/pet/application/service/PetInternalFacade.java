package com.hondigagae.domainlayer.pet.application.service;

import com.hondigagae.domainlayer.pet.adapter.in.internal.dto.PetConditionResponse;
import com.hondigagae.domainlayer.pet.adapter.in.internal.presenter.PetInternalPresenter;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.application.port.in.PetInternalUseCase;
import com.hondigagae.domainlayer.pet.application.service.processor.PetQueryProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PetInternalFacade implements PetInternalUseCase {

    private final PetQueryProcessor petQueryProcessor;
    private final PetInternalPresenter petInternalPresenter;

    /**
     * 소유권 검사를 웹 경로와 <b>같은 Processor</b>로 한다.
     *
     * <p>호출한 서비스가 이미 확인했더라도 여기서 다시 본다. 내부 호출이라는 이유로 검사를
     * 생략하면, 그 서비스에 생긴 버그 하나가 남의 반려견 정보를 새게 만든다.
     */
    @Override
    @Transactional(readOnly = true)
    public PetConditionResponse getPetCondition(long memberId, long petId) {
        PetInfo petInfo = petQueryProcessor.getMyPet(memberId, petId);
        return petInternalPresenter.toConditionResponse(petInfo);
    }

    @Override
    @Transactional(readOnly = true)
    public PetConditionResponse getRepresentativePetCondition(long memberId) {
        return petInternalPresenter.toConditionResponse(petQueryProcessor.getRepresentativePetInfo(memberId));
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.List<PetConditionResponse> getPetConditions(long memberId, java.util.List<Long> petIds) {
        return petQueryProcessor.getMyPetInfos(memberId, petIds).stream()
            .map(petInternalPresenter::toConditionResponse)
            .toList();
    }
}
