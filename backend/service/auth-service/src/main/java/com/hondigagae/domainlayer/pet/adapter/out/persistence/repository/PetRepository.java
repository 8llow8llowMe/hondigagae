package com.hondigagae.domainlayer.pet.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.pet.adapter.out.persistence.entity.PetEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PetRepository extends JpaRepository<PetEntity, Long> {

    List<PetEntity> findAllByMemberIdAndDeletedFalseOrderByIdAsc(long memberId);

    Optional<PetEntity> findByIdAndDeletedFalse(long petId);

    long countByMemberIdAndDeletedFalse(long memberId);

    /** 고아 이미지 청소용 — 소프트 삭제된 반려견의 키도 행이 남아 있는 한 참조로 본다. */
    @org.springframework.data.jpa.repository.Query("select p.profileImageKey from PetEntity p where p.profileImageKey is not null")
    java.util.List<String> findAllProfileImageKeys();
}