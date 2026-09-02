package com.hondigagae.domainlayer.planner.application.service.worker;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobEventPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.application.port.out.FavoritePlaceIdsQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.PlaceCandidateQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.PlanOutlineQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.WeatherOutlookQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import com.hondigagae.global.properties.AiLlmProperties;
import java.util.ArrayList;
import java.util.List;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiPlanWorker {

    private final AiPlanJobStorePort aiPlanJobStorePort;
    private final AiPlanJobEventPort aiPlanJobEventPort;
    private final AiLlmPort aiLlmPort;
    private final PlaceCandidateQueryPort placeCandidateQueryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final PlanOutlineQueryPort planOutlineQueryPort;
    private final FavoritePlaceIdsQueryPort favoritePlaceIdsQueryPort;
    private final WeatherOutlookQueryPort weatherOutlookQueryPort;
    private final AiLlmProperties aiLlmProperties;

    @Async("aiPlanTaskExecutor")
    public void runJob(String jobId) {
        AiPlanJob running;
        try {
            Optional<AiPlanJob> jobHolder = aiPlanJobStorePort.findById(jobId);
            if (jobHolder.isEmpty()) {
                log.warn("AI plan job missing on worker pickup jobId={}", jobId);
                return;
            }
            AiPlanJob job = jobHolder.get();
            if (job.status() != AiPlanJobStatus.PENDING) {
                log.info("AI plan job already advanced before worker pickup jobId={} status={}", jobId, job.status());
                return;
            }
            running = aiPlanJobStorePort.save(job.withStatus(AiPlanJobStatus.RUNNING, Instant.now()));
            aiPlanJobEventPort.publishJobUpdated(jobId);
        } catch (RuntimeException pickupFailure) {
            log.error("AI plan job pickup failed jobId={} reason={}", jobId, pickupFailure.getMessage(), pickupFailure);
            return;
        }

        try {
            // LLM 포트는 domain model을 주고, 잡에도 domain 그대로 저장한다. Info 변환은 응답 조립 시점(Processor)에 한다.
            AiPlanDraft draft = aiLlmPort.generatePlanDraft(toQuery(running.requestParams(), running.memberId()));
            log.info("AI plan draft generated jobId={} days={}", running.jobId(),
                draft.days() == null ? 0 : draft.days().size());
            aiPlanJobStorePort.save(running.completedWithDraft(draft, Instant.now()));
        } catch (AiPlanException domainException) {
            log.error("AI plan job failed jobId={} memberId={} errorCode={} cause={}",
                running.jobId(), running.memberId(),
                domainException.getErrorCode().getCode(), domainException.getMessage(), domainException);
            aiPlanJobStorePort.save(running.failed(
                domainException.getErrorCode().getCode(), domainException.getErrorCode().getMessage(), Instant.now()
            ));
        } catch (Exception unexpected) {
            log.error("AI plan job failed unexpectedly jobId={} memberId={} type={} cause={}",
                running.jobId(), running.memberId(),
                unexpected.getClass().getSimpleName(), unexpected.getMessage(), unexpected);
            aiPlanJobStorePort.save(running.failed(
                AiPlanErrorCode.JOB_FAILED.getCode(), AiPlanErrorCode.JOB_FAILED.getMessage(), Instant.now()
            ));
        } finally {
            aiPlanJobStorePort.releaseIdempotencyKey(running.memberId(), running.requestHash());
            // 종결(완료/실패) 저장은 위 모든 경로에서 finally 이전에 끝난다. 여기서 한 번만 알린다.
            aiPlanJobEventPort.publishJobUpdated(running.jobId());
        }
    }

    /**
     * 저장된 요청 파라미터를 LLM 질의로 옮기면서 <b>후보 장소를 여기서 붙인다.</b>
     *
     * <p>후보 조회를 어댑터가 아니라 이 계층이 하는 이유는, 어떤 데이터를 근거로 쓸지가
     * provider 세부사항이 아니라 <b>유스케이스의 결정</b>이기 때문이다. provider 를 바꿔도
     * "실제 DB 에 있는 동반 가능 장소 안에서만 고른다"는 규칙은 그대로 남아야 한다.
     */
    private AiPlanGenerationQuery toQuery(Map<String, String> params, Long memberId) {
        String areaCode = params.get("areaCode");
        List<Long> pinnedPlaceIds = parseIdList(params.get("pinnedPlaceIds"));
        List<Long> favoritePlaceIds = loadFavoritePlaceIds(params.get("preferFavorites"), memberId);
        Integer regenerateDay = parseNullableInt(params.get("regenerateDay"));
        return AiPlanGenerationQuery.builder()
            .areaCode(areaCode)
            .startDate(params.get("startDate"))
            .endDate(params.get("endDate"))
            .budget(params.get("budget"))
            .requestNote(params.get("requestNote"))
            .petConditions(loadPetConditions(params.get("petIds"), memberId))
            .pinnedPlaceIds(pinnedPlaceIds)
            .favoritePlaceIds(favoritePlaceIds)
            .weatherOutlook(loadWeatherOutlook(areaCode, params.get("startDate"), params.get("endDate")))
            .regenerateDay(regenerateDay)
            .planOutline(loadPlanOutline(params.get("planId"), regenerateDay, memberId))
            .placeCandidates(loadCandidates(areaCode, pinnedPlaceIds, favoritePlaceIds))
            .build();
    }

    /**
     * 반려견 특성을 붙인다. "반려견 맞춤"의 근거가 되는 값이라 여기서 조회하지 않으면
     * 프롬프트가 어떤 반려견인지 모른 채 일정을 짠다 — 소형견 전용 카페가 대형견 일정에
     * 들어가는 종류의 오류다. 조회 실패는 특성 없이 진행하되 경고를 남긴다.
     *
     * <p>요청이 반려견을 지정하지 않았으면 <b>대표 반려견</b>으로 대신한다 — 한 마리만
     * 키우는 사용자가 매번 petId 를 고르게 하지 않기 위한 기본값이다.
     */
    private List<PetCondition> loadPetConditions(String petIdsParam, Long memberId) {
        if (memberId == null) {
            return List.of();
        }
        List<Long> petIds = parseIdList(petIdsParam);
        if (petIds.isEmpty()) {
            PetCondition representative = petConditionQueryPort.findRepresentativeCondition(memberId).orElse(null);
            if (representative == null) {
                log.warn("AI plan generating without pet condition (no representative) memberId={}", memberId);
                return List.of();
            }
            return List.of(representative);
        }
        // 벌크 한 번으로 가져온다 — 마리 수만큼 HTTP 왕복하지 않는다 (§9-7).
        List<PetCondition> conditions = petConditionQueryPort.findConditions(memberId, petIds);
        if (conditions.size() < petIds.size()) {
            log.warn("AI plan generating with partial pet conditions requested={} resolved={} memberId={}",
                petIds.size(), conditions.size(), memberId);
        }
        return conditions;
    }

    /**
     * 하루 재생성이면 기존 일정 개요를 붙인다. 반려견 특성과 달리 <b>없으면 진행하지 않는다</b> —
     * "2일차만 다시"에서 기존 일정을 모르면 나머지 날을 유지할 방법이 없다.
     * 삭제됐거나 남의 일정이면(404) 명확한 코드로 잡을 실패시킨다.
     */
    private PlanOutline loadPlanOutline(String planIdParam, Integer regenerateDay, Long memberId) {
        if (regenerateDay == null || planIdParam == null || planIdParam.isBlank() || memberId == null) {
            return null;
        }
        long planId;
        try {
            planId = Long.parseLong(planIdParam);
        } catch (NumberFormatException exception) {
            log.warn("AI plan job carried an unusable planId={}", planIdParam);
            throw new AiPlanException(AiPlanErrorCode.PLAN_OUTLINE_UNAVAILABLE);
        }
        return planOutlineQueryPort.findOutline(memberId, planId)
            .orElseThrow(() -> new AiPlanException(AiPlanErrorCode.PLAN_OUTLINE_UNAVAILABLE));
    }

    private Integer parseNullableInt(String param) {
        if (param == null || param.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(param.trim());
        } catch (NumberFormatException exception) {
            log.warn("AI plan job carried an unusable int param={}", param);
            return null;
        }
    }

    private List<Long> parseIdList(String csvParam) {
        if (csvParam == null || csvParam.isBlank()) {
            return List.of();
        }
        List<Long> ids = new ArrayList<>();
        for (String token : csvParam.split(",")) {
            try {
                ids.add(Long.parseLong(token.trim()));
            } catch (NumberFormatException exception) {
                log.warn("AI plan job carried an unusable id token={}", token);
            }
        }
        return List.copyOf(ids);
    }

    /**
     * 후보 장소를 가져온다. <b>필요하다고 선언한 구현일 때만</b> 부른다.
     *
     * <p>스텁은 후보를 쓰지 않으므로 부르지 않는다. 무조건 불러 두면 키 없이 띄운 로컬에서
     * tour-service 까지 함께 떠 있어야 일정 생성이 도는 셈이 되어, 스텁을 남겨 둔 이유가 사라진다.
     */
    /**
     * 여행 기간에 걸치는 일자별 날씨 전망. 스텁 경로(requiresPlaceCandidates=false)에서는
     * 부르지 않는다 — 스텁을 tour-service 에 묶지 않기 위해서다. 조회 실패·커버리지 밖은
     * 빈 목록으로 관용 처리되어 프롬프트에서 날씨 절이 빠진다.
     */
    private List<DayWeatherOutlook> loadWeatherOutlook(String areaCode, String startDateParam, String endDateParam) {
        if (!aiLlmPort.requiresPlaceCandidates()) {
            return List.of();
        }
        java.time.LocalDate startDate;
        java.time.LocalDate endDate;
        try {
            startDate = java.time.LocalDate.parse(startDateParam);
            endDate = java.time.LocalDate.parse(endDateParam);
        } catch (RuntimeException exception) {
            log.warn("AI plan job carried unusable dates start={} end={}", startDateParam, endDateParam);
            return List.of();
        }
        return weatherOutlookQueryPort.findDailyOutlook(areaCode).stream()
            .filter(outlook -> !outlook.date().isBefore(startDate) && !outlook.date().isAfter(endDate))
            .toList();
    }

    /** 즐겨찾기는 선호일 뿐이라 조회 실패를 삼킨다(어댑터가 빈 목록으로 바꾼다). */
    private List<Long> loadFavoritePlaceIds(String preferFavoritesParam, Long memberId) {
        if (memberId == null || !Boolean.parseBoolean(preferFavoritesParam)) {
            return List.of();
        }
        return favoritePlaceIdsQueryPort.findFavoritePlaceIds(memberId);
    }

    /**
     * 후보 장소를 가져온다. <b>필요하다고 선언한 구현일 때만</b> 부른다.
     *
     * <p>스텁은 후보를 쓰지 않으므로 부르지 않는다. 무조건 불러 두면 키 없이 띄운 로컬에서
     * tour-service 까지 함께 떠 있어야 일정 생성이 도는 셈이 되어, 스텁을 남겨 둔 이유가 사라진다.
     */
    private List<PlaceCandidate> loadCandidates(String areaCode, List<Long> pinnedPlaceIds, List<Long> favoritePlaceIds) {
        if (!aiLlmPort.requiresPlaceCandidates()) {
            return List.of();
        }
        List<PlaceCandidate> searched = placeCandidateQueryPort
            .findPetFriendlyCandidates(areaCode, aiLlmProperties.placeCandidateSize()).stream()
            .map(this::toCandidate)
            .toList();
        if (pinnedPlaceIds.isEmpty()) {
            return mergeFavorites(searched, favoritePlaceIds);
        }

        // 필수 포함 장소는 검색 상위 N 에 없어도 후보에 있어야 한다. 아이디로 직접 가져와 합친다.
        List<PlaceCandidate> pinned = placeCandidateQueryPort.findCandidatesByIds(pinnedPlaceIds).stream()
            .map(this::toCandidate)
            .toList();
        Set<Long> pinnedFound = pinned.stream().map(PlaceCandidate::placeId).collect(Collectors.toSet());
        List<Long> missing = pinnedPlaceIds.stream().filter(id -> !pinnedFound.contains(id)).toList();
        if (!missing.isEmpty()) {
            // 사용자가 "꼭 넣어 달라"고 한 장소다. 조용히 빼고 생성하면 결과를 믿을 수 없게 된다 — 명확한 실패가 낫다.
            log.warn("AI plan pinned places unavailable missing={}", missing);
            throw new AiPlanException(AiPlanErrorCode.PINNED_PLACE_UNAVAILABLE);
        }

        List<PlaceCandidate> merged = new ArrayList<>(pinned);
        searched.stream().filter(candidate -> !pinnedFound.contains(candidate.placeId())).forEach(merged::add);
        return mergeFavorites(List.copyOf(merged), favoritePlaceIds);
    }

    /**
     * 즐겨찾기 장소를 후보에 합친다. 필수 포함과 달리 <b>없어도 실패하지 않는다</b> —
     * 선호는 신호일 뿐이고, 원천에서 사라진 장소는 조용히 빠진다.
     */
    private List<PlaceCandidate> mergeFavorites(List<PlaceCandidate> candidates, List<Long> favoritePlaceIds) {
        if (favoritePlaceIds.isEmpty()) {
            return candidates;
        }
        Set<Long> existing = candidates.stream().map(PlaceCandidate::placeId).collect(Collectors.toSet());
        List<Long> missingIds = favoritePlaceIds.stream().filter(id -> !existing.contains(id)).toList();
        if (missingIds.isEmpty()) {
            return candidates;
        }
        List<PlaceCandidate> extras;
        try {
            extras = placeCandidateQueryPort.findCandidatesByIds(missingIds).stream()
                .map(this::toCandidate)
                .toList();
        } catch (AiPlanException exception) {
            log.warn("Favorite candidates lookup failed, continuing without them. errorCode={}",
                exception.getErrorCode().getCode());
            return candidates;
        }
        List<PlaceCandidate> merged = new ArrayList<>(candidates);
        merged.addAll(extras);
        return List.copyOf(merged);
    }

    private PlaceCandidate toCandidate(PlaceCandidateQueryResult result) {
        return PlaceCandidate.builder()
            .placeId(result.placeId())
            .title(result.title())
            .contentTypeName(result.contentTypeName())
            .addr(result.addr())
            .petAllowanceName(result.petAllowanceName())
            .allowedPetSizeName(result.allowedPetSizeName())
            .maxPetWeightKg(result.maxPetWeightKg())
            .indoor(result.indoor())
            .sourceCategory(result.sourceCategory())
            .lat(result.lat())
            .lng(result.lng())
            .build();
    }
}
