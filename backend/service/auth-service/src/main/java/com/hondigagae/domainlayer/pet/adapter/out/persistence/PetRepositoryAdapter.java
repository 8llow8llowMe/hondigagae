package com.hondigagae.domainlayer.pet.adapter.out.persistence;

import com.hondigagae.domainlayer.pet.adapter.out.persistence.entity.PetEntity;
import com.hondigagae.domainlayer.pet.adapter.out.persistence.repository.PetRepository;
import com.hondigagae.domainlayer.pet.application.mapper.PetMapper;
import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PetRepositoryAdapter implements PetRepositoryPort {

    private final PetRepository petRepository;
    private final PetMapper petMapper;

    @Override
    public Pet save(Pet domain) {
        PetEntity savedEntity = petRepository.save(petMapper.toEntityFromDomain(domain));
        return petMapper.toDomainFromEntity(savedEntity);
    }

    @Override
    public List<Pet> findAllByMemberId(long memberId) {
        return petRepository.findAllByMemberIdAndDeletedFalseOrderByIdAsc(memberId).stream()
            .map(petMapper::toDomainFromEntity)
            .toList();
    }

    @Override
    public Optional<Pet> findById(long petId) {
        return petRepository.findByIdAndDeletedFalse(petId)
            .map(petMapper::toDomainFromEntity);
    }

    @Override
    public long countByMemberId(long memberId) {
        return petRepository.countByMemberIdAndDeletedFalse(memberId);
    }

    @Override
    public List<String> findAllProfileImageKeys() {
        return petRepository.findAllProfileImageKeys();
    }
}
