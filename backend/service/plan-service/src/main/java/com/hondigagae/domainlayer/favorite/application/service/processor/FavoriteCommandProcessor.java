package com.hondigagae.domainlayer.favorite.application.service.processor;

import com.hondigagae.domainlayer.favorite.application.exception.FavoriteErrorCode;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteException;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoritePlaceLookupPort;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoriteRepositoryPort;
import com.hondigagae.domainlayer.favorite.domain.model.Favorite;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FavoriteCommandProcessor {

    /** 회원당 즐겨찾기 상한. 제주 장소 마스터가 수백 곳 규모라 개인 사용에 충분하다. */
    private static final long MAX_FAVORITE_COUNT = 100L;

    private final FavoriteRepositoryPort favoriteRepositoryPort;
    private final FavoritePlaceLookupPort favoritePlaceLookupPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    /**
     * 즐겨찾기 저장. <b>멱등이다</b> — 이미 저장된 장소면 그대로 성공으로 본다.
     * 토글 UI 의 연타나 재시도가 오류로 튀지 않게 하기 위해서다.
     *
     * <p>장소 존재 검증은 tour-service 조회로 한다. 노출 불가(병합·delisted) 장소는
     * 조회 결과에서 빠지므로 "없는 장소를 찜한" 상태를 만들지 않는다.
     */
    public Favorite add(long memberId, long placeId) {
        Favorite existing = favoriteRepositoryPort.findByMemberIdAndPlaceId(memberId, placeId).orElse(null);
        if (existing != null) {
            return existing;
        }
        if (favoriteRepositoryPort.countByMemberId(memberId) >= MAX_FAVORITE_COUNT) {
            throw new FavoriteException(FavoriteErrorCode.FAVORITE_LIMIT_EXCEEDED);
        }
        if (favoritePlaceLookupPort.findSummaries(List.of(placeId)).isEmpty()) {
            throw new FavoriteException(FavoriteErrorCode.NOT_FOUND_PLACE);
        }
        return favoriteRepositoryPort.save(Favorite.builder()
            .id(snowflakeIdGenerator.generateId())
            .memberId(memberId)
            .placeId(placeId)
            .build());
    }

    /** 즐겨찾기 해제. 저장과 마찬가지로 멱등이다 — 없는 것을 지워도 성공으로 본다. */
    public void remove(long memberId, long placeId) {
        favoriteRepositoryPort.findByMemberIdAndPlaceId(memberId, placeId)
            .ifPresent(favorite -> favoriteRepositoryPort.deleteById(favorite.id()));
    }
}
