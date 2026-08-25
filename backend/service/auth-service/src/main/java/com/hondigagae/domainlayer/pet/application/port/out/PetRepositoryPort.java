package com.hondigagae.domainlayer.pet.application.port.out;

import com.hondigagae.domainlayer.pet.domain.model.Pet;
import java.util.List;
import java.util.Optional;

public interface PetRepositoryPort {

    Pet save(Pet domain);

    List<Pet> findAllByMemberId(long memberId);

    Optional<Pet> findById(long petId);

    long countByMemberId(long memberId);
}
