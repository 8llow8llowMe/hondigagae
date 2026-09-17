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

    Optional<Pet> findRepresentativeByMemberId(long memberId);

    /**
     * 회원의 반려견 행을 물리 삭제한다. 보존 기간이 지난 탈퇴 회원 정리 전용이라 소프트 삭제
     * 여부를 보지 않는다 — 부모(member)가 사라지는 마당에 남겨 둘 이유가 없다.
     */
    void deleteAllByMemberIdIn(List<Long> memberIds);
}
