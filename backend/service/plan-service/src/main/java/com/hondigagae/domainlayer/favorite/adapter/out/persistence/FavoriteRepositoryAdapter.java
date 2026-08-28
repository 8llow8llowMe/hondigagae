package com.hondigagae.domainlayer.favorite.adapter.out.persistence;

import com.hondigagae.domainlayer.favorite.adapter.out.persistence.repository.FavoriteRepository;
import com.hondigagae.domainlayer.favorite.application.mapper.FavoriteMapper;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoriteRepositoryPort;
import com.hondigagae.domainlayer.favorite.domain.model.Favorite;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class FavoriteRepositoryAdapter implements FavoriteRepositoryPort {

    private final FavoriteRepository favoriteRepository;
    private final FavoriteMapper favoriteMapper;

    @Override
    public Favorite save(Favorite favorite) {
        return favoriteMapper.toDomainFromEntity(
            favoriteRepository.save(favoriteMapper.toEntityFromDomain(favorite)));
    }

    @Override
    public Optional<Favorite> findByMemberIdAndPlaceId(long memberId, long placeId) {
        return favoriteRepository.findByMemberIdAndPlaceId(memberId, placeId)
            .map(favoriteMapper::toDomainFromEntity);
    }

    @Override
    public List<Favorite> findAllByMemberId(long memberId) {
        return favoriteMapper.toDomainListFromEntityList(
            favoriteRepository.findAllByMemberIdOrderByIdDesc(memberId));
    }

    @Override
    public long countByMemberId(long memberId) {
        return favoriteRepository.countByMemberId(memberId);
    }

    @Override
    public void deleteById(long favoriteId) {
        favoriteRepository.deleteById(favoriteId);
    }
}
