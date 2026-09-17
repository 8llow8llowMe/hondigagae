package com.hondigagae.domainlayer.pet.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.pet.adapter.out.persistence.entity.PetEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PetRepository extends JpaRepository<PetEntity, Long> {

    List<PetEntity> findAllByMemberIdAndDeletedFalseOrderByIdAsc(long memberId);

    Optional<PetEntity> findByIdAndDeletedFalse(long petId);

    long countByMemberIdAndDeletedFalse(long memberId);

    /** 고아 이미지 청소용 — 소프트 삭제된 반려견의 키도 행이 남아 있는 한 참조로 본다. */
    @Query("select p.profileImageKey from PetEntity p where p.profileImageKey is not null")
    List<String> findAllProfileImageKeys();

    /** 대표견은 회원당 하나가 불변식이지만, 깨졌을 때도 결정적이도록 가장 먼저 등록한 것을 택한다. */
    Optional<PetEntity> findFirstByMemberIdAndRepresentativeTrueAndDeletedFalseOrderByIdAsc(long memberId);

    /**
     * 탈퇴 회원 정리용 물리 삭제. 파생 delete 는 엔티티를 읽어 한 행씩 지우므로 단일 delete 문으로 둔다.
     */
    @Modifying
    @Query("delete from PetEntity p where p.memberId in :memberIds")
    void deleteAllByMemberIdIn(List<Long> memberIds);
}