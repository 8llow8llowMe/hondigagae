package com.hondigagae.domainlayer.pet.application.mapper;

import com.hondigagae.domainlayer.pet.adapter.out.persistence.entity.PetEntity;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface PetMapper {

    // 엔티티 -> 도메인
    Pet toDomainFromEntity(PetEntity entity);

    // 도메인 -> 엔티티
    PetEntity toEntityFromDomain(Pet domain);
}
