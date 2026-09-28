package com.hondigagae.domainlayer.pet.application.service;

import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetProfileImageUploadResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetsResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.presenter.PetPresenter;
import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.application.info.PetProfileImageChangeResult;
import com.hondigagae.domainlayer.pet.application.port.in.PetWebUseCase;
import com.hondigagae.domainlayer.pet.application.port.out.PlanCompanionCommandPort;
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
    private final PlanCompanionCommandPort planCompanionCommandPort;

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

    /**
     * 반려견 삭제 → (커밋) → plan-service 에 동행 목록 대사 요청 (#972).
     *
     * <p><b>이 메서드에 {@code @Transactional} 을 붙이지 않는다.</b> 대사 요청은 원격 호출이라 트랜잭션 안에서
     * 부르면 DB 커넥션을 잡은 채 plan 응답을 기다린다. 더 큰 이유는 <b>순서</b>다 — plan 은 요청을 받으면
     * auth 에 "살아 있는 반려견" 을 되묻는데, 삭제가 아직 커밋되지 않았으면 방금 지운 아이가 살아 있다고
     * 답해 아무것도 떼지 않는다. 반대로 plan 이 뗀 뒤 auth 가 롤백되면 살아 있는 아이가 일정에서 사라진다.
     * 그래서 DB 구간은 {@link PetCommandProcessor#delete} 가 스스로 트랜잭션을 열고 닫으며, 요청은 그 커밋 뒤에 간다.
     *
     * <p><b>{@code @Async} 로 빼지 않았다.</b> 반려견 삭제는 드문 조작이라 응답 지연(최대 connect 2s + read 5s)이
     * 감당할 만하고, 같은 요청 스레드에서 도는 편이 로그 상관관계와 실패 관측이 쉽다. p99 가 문제가 되면
     * 그때 전용 executor 로 옮긴다. 어느 쪽이든 실패는 삭제를 막지 않는다 — 포트가 던지지 않는다.
     */
    @Override
    public void deletePet(long memberId, long petId) {
        petCommandProcessor.delete(memberId, petId);
        planCompanionCommandPort.reconcileCompanions(memberId, petId);
    }

    @Override
    @Transactional
    public PetResponse markRepresentative(long memberId, long petId) {
        PetInfo petInfo = petCommandProcessor.markRepresentative(memberId, petId);
        return petPresenter.toPetResponse(petInfo);
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
