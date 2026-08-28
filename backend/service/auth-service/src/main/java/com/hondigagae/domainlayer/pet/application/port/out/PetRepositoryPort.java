package com.hondigagae.domainlayer.pet.application.port.out;

import com.hondigagae.domainlayer.pet.domain.model.Pet;
import java.util.List;
import java.util.Optional;

public interface PetRepositoryPort {

    Pet save(Pet domain);

    List<Pet> findAllByMemberId(long memberId);

    Optional<Pet> findById(long petId);

    long countByMemberId(long memberId);

    /** 스토리지에 실제로 참조 중인 프로필 이미지 키 전부. 고아 객체 청소의 대조군이다. */
    List<String> findAllProfileImageKeys();
}
