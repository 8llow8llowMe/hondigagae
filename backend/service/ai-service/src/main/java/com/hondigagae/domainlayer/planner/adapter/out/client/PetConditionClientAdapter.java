package com.hondigagae.domainlayer.planner.adapter.out.client;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PetConditionClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PetConditionClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.port.out.PetConditionQueryPort;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 반려견 특성 조회 어댑터.
 *
 * <p><b>실패를 예외로 올리지 않고 빈 값으로 바꾼다.</b> auth-service 가 흔들렸다고 일정
 * 생성 자체가 막히면 안 된다. 특성이 빠진 채 생성됐다는 사실은 로그로 남긴다 —
 * plan-service 의 날씨 브리핑과 같은 관용 원칙이다.
 *
 * <p>enum 코드(SMALL, HIGH ...)를 한국어 표시명으로 여기서 바꾼다. 프롬프트는 사람이 읽는
 * 문장이고, 변환 규칙은 provider 가 아니라 데이터의 성질이라 어댑터 경계에서 끝낸다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PetConditionClientAdapter implements PetConditionQueryPort {

    private static final String AUTH_SERVICE = "auth-service";

    private final PetConditionClient petConditionClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public Optional<PetCondition> findCondition(long memberId, long petId) {
        try {
            PetConditionClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
                AUTH_SERVICE, () -> petConditionClient.getPetCondition(petId, memberId));
            if (body == null) {
                log.info("Pet condition not found petId={} memberId={}", petId, memberId);
                return Optional.empty();
            }
            return Optional.of(toCondition(body));
        } catch (AiPlanException exception) {
            log.warn("Pet condition lookup failed petId={} errorCode={}",
                petId, exception.getErrorCode().getCode());
            return Optional.empty();
        }
    }

    @Override
    public List<PetCondition> findConditions(long memberId, List<Long> petIds) {
        if (petIds == null || petIds.isEmpty()) {
            return List.of();
        }
        try {
            List<PetConditionClientResponse> body = internalResponseSupport.requestAndUnwrapOrNull(
                AUTH_SERVICE, () -> petConditionClient.getPetConditions(memberId, petIds));
            if (body == null) {
                log.info("Pet conditions not found memberId={} petIds={}", memberId, petIds);
                return List.of();
            }
            return body.stream().map(this::toCondition).toList();
        } catch (AiPlanException exception) {
            log.warn("Pet conditions lookup failed memberId={} errorCode={}",
                memberId, exception.getErrorCode().getCode());
            return List.of();
        }
    }

    @Override
    public Optional<PetCondition> findRepresentativeCondition(long memberId) {
        try {
            PetConditionClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
                AUTH_SERVICE, () -> petConditionClient.getRepresentativePetCondition(memberId));
            if (body == null) {
                log.info("Representative pet condition not found memberId={}", memberId);
                return Optional.empty();
            }
            return Optional.of(toCondition(body));
        } catch (AiPlanException exception) {
            log.warn("Representative pet condition lookup failed memberId={} errorCode={}",
                memberId, exception.getErrorCode().getCode());
            return Optional.empty();
        }
    }

    private PetCondition toCondition(PetConditionClientResponse body) {
        return PetCondition.builder()
            .breed(body.breed())
            .sizeName(sizeName(body.sizeType()))
            .weightText(weightText(body.weightKg()))
            .heatSensitive(body.heatSensitive())
            .coldSensitive(body.coldSensitive())
            .noiseSensitive(body.noiseSensitive())
            .activityName(activityName(body.activityLevel()))
            .walkPreferred(body.walkPreferred())
            .build();
    }

    /** BigDecimal 을 "3.5" 같은 사람이 읽는 표기로. 값이 없으면 null 유지. */
    private String weightText(java.math.BigDecimal weightKg) {
        return weightKg == null ? null : weightKg.stripTrailingZeros().toPlainString();
    }

    private String sizeName(String sizeType) {
        try {
            return PetSizeType.valueOf(sizeType).getDisplayName();
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private String activityName(String activityLevel) {
        try {
            return ActivityLevel.valueOf(activityLevel).getDisplayName();
        } catch (RuntimeException exception) {
            return null;
        }
    }
}
