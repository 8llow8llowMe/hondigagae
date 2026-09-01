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
     * 대표 반려견. 등록 시 첫 반려견이 자동 지정되고 삭제 시 승계되므로,
     * 반려견이 한 마리라도 있으면 반드시 존재한다. 없으면 404.
     */
    public Pet getRepresentativePet(long memberId) {
        return petRepositoryPort.findRepresentativeByMemberId(memberId)
            .orElseThrow(() -> new PetException(PetErrorCode.NOT_FOUND_PET));
    }

    /** 내부 API 파사드용 — 다른 조회와 같이 Processor 가 Info 변환까지 책임져 대칭을 유지한다. */
    public PetInfo getRepresentativePetInfo(long memberId) {
        return PetInfo.from(getRepresentativePet(memberId));
    }

    /**
     * 요청한 petId 중 본인 소유만 골라 준다(내부 벌크 조회용). 회원당 최대 5마리라
     * 전체 목록 한 번 조회로 충분하다 — 소유 검증과 조회가 쿼리 하나로 끝난다.
     * 남의 것/없는 것은 조용히 빠진다 — 내부 호출부가 누락으로 판단하고 관용 처리한다.
     */
    public List<PetInfo> getMyPetInfos(long memberId, List<Long> petIds) {
        java.util.Set<Long> requested = new java.util.HashSet<>(petIds);
        return petRepositoryPort.findAllByMemberId(memberId).stream()
            .filter(pet -> requested.contains(pet.id()))
            .map(PetInfo::from)
            .toList();
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
