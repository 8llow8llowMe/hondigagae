package com.hondigagae.domainlayer.pet.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.pet.adapter.out.persistence.entity.PetEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PetRepository extends JpaRepository<PetEntity, Long> {

    List<PetEntity> findAllByMemberIdAndDeletedFalseOrderByIdAsc(long memberId);

    Optional<PetEntity> findByIdAndDeletedFalse(long petId);

    long countByMemberIdAndDeletedFalse(long memberId);
}
