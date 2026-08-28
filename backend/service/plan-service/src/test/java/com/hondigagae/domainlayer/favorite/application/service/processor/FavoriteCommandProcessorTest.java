package com.hondigagae.domainlayer.favorite.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.favorite.application.exception.FavoriteErrorCode;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteException;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoritePlaceLookupPort;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoriteRepositoryPort;
import com.hondigagae.domainlayer.favorite.application.port.out.query.FavoritePlaceQueryResult;
import com.hondigagae.domainlayer.favorite.domain.model.Favorite;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FavoriteCommandProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long VISIBLE_PLACE_ID = 100L;
    private static final long MISSING_PLACE_ID = 999L;

    private StubFavoriteRepositoryPort favoriteRepositoryPort;
    private StubFavoritePlaceLookupPort favoritePlaceLookupPort;
    private FavoriteCommandProcessor processor;

    @BeforeEach
    void setUp() {
        favoriteRepositoryPort = new StubFavoriteRepositoryPort();
        favoritePlaceLookupPort = new StubFavoritePlaceLookupPort(Set.of(VISIBLE_PLACE_ID));
        processor = new FavoriteCommandProcessor(
            favoriteRepositoryPort, favoritePlaceLookupPort, new SnowflakeIdGenerator(0, 0));
    }

    @Test
    void add_visiblePlace_saves() {
        Favorite saved = processor.add(MEMBER_ID, VISIBLE_PLACE_ID);

        assertThat(saved.placeId()).isEqualTo(VISIBLE_PLACE_ID);
        assertThat(favoriteRepositoryPort.countByMemberId(MEMBER_ID)).isEqualTo(1);
    }

    @Test
    void add_alreadySaved_isIdempotent() {
        Favorite first = processor.add(MEMBER_ID, VISIBLE_PLACE_ID);
        Favorite second = processor.add(MEMBER_ID, VISIBLE_PLACE_ID);

        // 토글 연타·재시도가 오류로 튀지 않는다 — 같은 저장을 그대로 돌려준다
        assertThat(second.id()).isEqualTo(first.id());
        assertThat(favoriteRepositoryPort.countByMemberId(MEMBER_ID)).isEqualTo(1);
    }

    @Test
    void add_missingPlace_rejects() {
        // 노출 불가(병합·delisted) 장소는 요약 조회에서 빠진다 — "없는 장소를 찜한" 상태를 만들지 않는다
        assertThatThrownBy(() -> processor.add(MEMBER_ID, MISSING_PLACE_ID))
            .isInstanceOf(FavoriteException.class)
            .extracting(exception -> ((FavoriteException) exception).getErrorCode())
            .isEqualTo(FavoriteErrorCode.NOT_FOUND_PLACE);
    }

    @Test
    void remove_notSaved_isIdempotent() {
        processor.remove(MEMBER_ID, VISIBLE_PLACE_ID);

        assertThat(favoriteRepositoryPort.countByMemberId(MEMBER_ID)).isZero();
    }

    private static class StubFavoriteRepositoryPort implements FavoriteRepositoryPort {

        private final Map<Long, Favorite> store = new HashMap<>();

        @Override
        public Favorite save(Favorite favorite) {
            store.put(favorite.id(), favorite);
            return favorite;
        }

        @Override
        public Optional<Favorite> findByMemberIdAndPlaceId(long memberId, long placeId) {
            return store.values().stream()
                .filter(favorite -> favorite.memberId() == memberId && favorite.placeId() == placeId)
                .findFirst();
        }

        @Override
        public List<Favorite> findAllByMemberId(long memberId) {
            return store.values().stream()
                .filter(favorite -> favorite.memberId() == memberId)
                .sorted(Comparator.comparingLong(Favorite::id).reversed())
                .toList();
        }

        @Override
        public long countByMemberId(long memberId) {
            return findAllByMemberId(memberId).size();
        }

        @Override
        public void deleteById(long favoriteId) {
            store.remove(favoriteId);
        }
    }

    private static class StubFavoritePlaceLookupPort implements FavoritePlaceLookupPort {

        private final Set<Long> visiblePlaceIds;

        StubFavoritePlaceLookupPort(Set<Long> visiblePlaceIds) {
            this.visiblePlaceIds = new HashSet<>(visiblePlaceIds);
        }

        @Override
        public List<FavoritePlaceQueryResult> findSummaries(List<Long> placeIds) {
            return placeIds.stream()
                .filter(visiblePlaceIds::contains)
                .map(placeId -> FavoritePlaceQueryResult.builder()
                    .placeId(placeId)
                    .title("장소" + placeId)
                    .build())
                .toList();
        }
    }
}
