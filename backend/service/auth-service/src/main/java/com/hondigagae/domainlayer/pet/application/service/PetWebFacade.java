package com.hondigagae.domainlayer.pet.application.service;

import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetProfileImageUploadResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetsResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.presenter.PetPresenter;
import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.application.info.PetProfileImageChangeResult;
import com.hondigagae.domainlayer.pet.application.port.in.PetWebUseCase;
import com.hondigagae.domainlayer.pet.application.service.processor.PetCommandProcessor;
import com.hondigagae.domainlayer.pet.application.service.processor.PetQueryProcessor;
import com.hondigagae.storage.client.ObjectStorageClient;
import com.hondigagae.storage.model.FileUploadCommand;
import com.hondigagae.storage.model.StorageDomain;
import com.hondigagae.storage.model.StoredObject;
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
    private final ObjectStorageClient objectStorageClient;

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

    /**
     * 프로필 이미지 업로드.
     *
     * <p>이 메서드에 {@code @Transactional} 을 붙이지 않는다. 스토리지 업로드는 원격 I/O 라
     * 트랜잭션 안에서 수행하면 DB 커넥션을 잡은 채 대기하게 된다. 회원 프로필 이미지
     * ({@code MemberWebFacade})와 같은 순서를 따른다: 업로드 → DB 반영 → 성공 시 이전 객체 삭제 /
     * 실패 시 방금 올린 객체 회수. 어느 단계에서 끓겨도 "DB 에는 있는데 파일이 없는" 상태가 되지 않는다.
     */
    @Override
    public PetProfileImageUploadResponse uploadProfileImage(long memberId, long petId, FileUploadCommand command) {
        StoredObject storedObject = objectStorageClient.uploadImage(StorageDomain.PET_PROFILE, memberId, command);
        try {
            PetProfileImageChangeResult result = petCommandProcessor.updateProfileImage(memberId, petId, storedObject.objectKey());
            objectStorageClient.deleteQuietly(result.previousObjectKey());
            return petPresenter.toProfileImageUploadResponse(result.petInfo());
        } catch (RuntimeException exception) {
            // DB 반영에 실패했으므로 방금 올린 객체는 어디에서도 참조되지 않는다. 즉시 회수한다.
            objectStorageClient.deleteQuietly(storedObject.objectKey());
            throw exception;
        }
    }

    @Override
    public PetResponse removeProfileImage(long memberId, long petId) {
        PetProfileImageChangeResult result = petCommandProcessor.removeProfileImage(memberId, petId);
        objectStorageClient.deleteQuietly(result.previousObjectKey());
        return petPresenter.toPetResponse(result.petInfo());
    }
}
