package com.hondigagae.domainlayer.planner.adapter.out.client;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.FavoritePlaceIdsClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.port.out.FavoritePlaceIdsQueryPort;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 즐겨찾기 아이디 조회 어댑터. <b>실패를 예외로 올리지 않는다</b> — 즐겨찾기는 선호일 뿐이라
 * plan-service 가 흔들렸다고 일정 생성이 막히면 안 된다. 빠졌다는 사실은 로그로 남긴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FavoritePlaceIdsClientAdapter implements FavoritePlaceIdsQueryPort {

    private static final String PLAN_SERVICE = "plan-service";

    private final FavoritePlaceIdsClient favoritePlaceIdsClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<Long> findFavoritePlaceIds(long memberId) {
        try {
            List<Long> body = internalResponseSupport.requestAndUnwrapOrNull(
                PLAN_SERVICE, () -> favoritePlaceIdsClient.getFavoritePlaceIds(memberId));
            return body == null ? List.of() : body;
        } catch (AiPlanException exception) {
            log.warn("Favorite place ids lookup failed memberId={} errorCode={}",
                memberId, exception.getErrorCode().getCode());
            return List.of();
        }
    }
}
