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
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
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
            // 위 status 확인과 save 사이에 취소·타임아웃이 끼어들 수 있다. 저장소가 종결을
            // 덮지 않고 저장된 잡을 돌려주므로, 반영되지 않았으면 시작하지 않는다.
            if (running.status() != AiPlanJobStatus.RUNNING) {
                log.info("AI plan job already terminal before worker start jobId={} status={}", jobId, running.status());
                return;
            }
            aiPlanJobEventPort.publishJobUpdated(jobId);
        } catch (RuntimeException pickupFailure) {
            log.error("AI plan job pickup failed jobId={} reason={}", jobId, pickupFailure.getMessage(), pickupFailure);
            return;
        }

        // 단계를 옮길 때마다 최신 잡으로 갈아 끼운다. 종결 저장이 마지막 단계 위에서
        // 이뤄져야 어느 단계에서 실패했는지가 응답에 남는다.
        AtomicReference<AiPlanJob> current = new AtomicReference<>(running);
        /*
         * 단계별 소요시간을 잰다 (#570). 대기 화면이 1/4 에서 4/4 로 튄다는 보고가 있었는데,
         * 네 단계가 모두 기록된다는 것은 코드로 확인됐다 — 남은 가설은 "2·3단계가 너무 짧다" 이고
         * 그것을 가릴 증거가 없었다. 여기서 재면 표현을 손대야 하는지 아닌지를 말할 수 있다.
         */
        StepTimer stepTimer = new StepTimer(jobId);
        try {
            AiPlanGenerationQuery query =
                toQuery(running, step -> current.set(advanceTo(current.get(), step, stepTimer)));

            current.set(advanceTo(current.get(), AiPlanJobStep.DRAFTING, stepTimer));
            // LLM 포트는 domain model을 주고, 잡에도 domain 그대로 저장한다. Info 변환은 응답 조립 시점(Processor)에 한다.
            AiPlanDraft draft = aiLlmPort.generatePlanDraft(query);
            stepTimer.finish();
            log.info("AI plan draft generated jobId={} days={}", running.jobId(),
                draft.days() == null ? 0 : draft.days().size());

            // 가장 오래 걸리는 구간을 지나는 동안 취소되거나 타임아웃 판정(FAILED)됐을 수 있다.
            // 저장소가 종결을 덮지 않으므로, 반영되지 않았으면 초안을 버린다.
            AiPlanJob completed = aiPlanJobStorePort.save(current.get().completedWithDraft(draft, Instant.now()));
            if (completed.status() != AiPlanJobStatus.COMPLETED) {
                log.info("AI plan job already terminal, discarding draft jobId={} status={}",
                    running.jobId(), completed.status());
            }
        } catch (JobCanceledException canceled) {
            log.info("AI plan job already terminal, stopping before step={} jobId={}",
                canceled.stoppedBefore, running.jobId());
        } catch (AiPlanException domainException) {
            log.error("AI plan job failed jobId={} memberId={} step={} errorCode={} cause={}",
                running.jobId(), running.memberId(), current.get().step(),
                domainException.getErrorCode().getCode(), domainException.getMessage(), domainException);
            aiPlanJobStorePort.save(current.get().failed(
                domainException.getErrorCode().getCode(), domainException.getErrorCode().getMessage(), Instant.now()
            ));
        } catch (Exception unexpected) {
            log.error("AI plan job failed unexpectedly jobId={} memberId={} step={} type={} cause={}",
                running.jobId(), running.memberId(), current.get().step(),
                unexpected.getClass().getSimpleName(), unexpected.getMessage(), unexpected);
            aiPlanJobStorePort.save(current.get().failed(
                AiPlanErrorCode.JOB_FAILED.getCode(), AiPlanErrorCode.JOB_FAILED.getMessage(), Instant.now()
            ));
        } finally {
            aiPlanJobStorePort.releaseIdempotencyKey(running.memberId(), running.requestHash(), running.jobId());
            // 종결(완료/실패/취소) 저장은 위 모든 경로에서 finally 이전에 끝난다. 여기서 한 번만 알린다.
            aiPlanJobEventPort.publishJobUpdated(running.jobId());
        }
    }

    /**
     * 다음 단계로 옮기고 화면에 알린다. <b>취소·타임아웃을 확인하는 지점이기도 하다.</b>
     *
     * <p>취소는 실행 중인 스레드를 멈추지 못한다 — LLM 호출은 블로킹이고 중간에 끊을 수단이
     * 없다. 대신 단계 경계마다 저장소를 다시 읽어 협조적으로 멈춘다. 그래서 취소의 실익은
     * <b>가장 비싼 LLM 호출에 들어가기 전에 서는 것</b>이고, 이미 들어간 뒤라면 돌아온 결과를
     * 버리는 것까지가 할 수 있는 전부다. 이 성질을 응답 문서에도 적어 둔다.
     *
     * <p>CANCELED 만이 아니라 <b>모든 종결</b>에서 선다 — 폴링이 RUNNING 타임아웃으로 FAILED
     * 를 박아 둔 잡을 계속 진행하면, 사용자가 이미 재제출한 동일 요청과 나란히 돈다.
     *
     * <p>단계마다 Redis 를 한 번 더 읽지만 왕복 네 번은 LLM 한 번에 비하면 없는 값이다.
     * 읽기와 저장 사이의 남은 창은 저장소의 종결 보호 저장이 막는다.
     */
    private AiPlanJob advanceTo(AiPlanJob job, AiPlanJobStep step, StepTimer stepTimer) {
        AiPlanJob latest = aiPlanJobStorePort.findById(job.jobId()).orElse(job);
        if (latest.status().isTerminal()) {
            throw new JobCanceledException(step);
        }
        AiPlanJob advanced = aiPlanJobStorePort.save(latest.atStep(step));
        if (advanced.status().isTerminal()) {
            throw new JobCanceledException(step);
        }
        aiPlanJobEventPort.publishJobUpdated(job.jobId());
        stepTimer.enter(step);
        return advanced;
    }

    /**
     * 단계별 소요시간을 남긴다 (#570).
     *
     * <p><b>화면 동작을 바꾸지 않는다.</b> 지금 아는 것은 "사용자가 2·3단계를 못 봤다" 뿐이고,
     * 그것이 진행이 누락된 것인지 단계가 짧은 것인지는 갈리지 않았다. 짧은 것이라면 진행 막대는
     * 정직한 것이고, 균등한 4등분처럼 보이게 손대는 쪽이 오히려 거짓 진행률이 된다 —
     * {@link AiPlanJobStep} 머리주석이 "화면이 단계를 지어내면 거짓 진행률이 된다" 고 못박아 뒀다.
     * 그래서 <b>먼저 재기만 한다.</b>
     *
     * <p>스레드 하나가 한 잡을 처음부터 끝까지 도므로 동기화하지 않는다.
     */
    private static final class StepTimer {

        private final String jobId;
        private AiPlanJobStep enteredStep;
        private long enteredAtNanos;

        private StepTimer(String jobId) {
            this.jobId = jobId;
        }

        private void enter(AiPlanJobStep step) {
            logEnteredStep();
            enteredStep = step;
            enteredAtNanos = System.nanoTime();
        }

        /** 마지막 단계(DRAFTING)는 다음 전이가 없어 여기서 닫는다. */
        private void finish() {
            logEnteredStep();
            enteredStep = null;
        }

        private void logEnteredStep() {
            if (enteredStep == null) {
                return;
            }
            log.info("AI plan job step done jobId={} step={} order={}/{} elapsedMs={}",
                jobId, enteredStep, enteredStep.order(), AiPlanJobStep.total(),
                Duration.ofNanos(System.nanoTime() - enteredAtNanos).toMillis());
        }
    }

    /** 취소·타임아웃 등 종결로 인한 중단. 실패가 아니라서 오류 경로와 섞지 않으려고 따로 둔다. */
    private static final class JobCanceledException extends RuntimeException {

        private final transient AiPlanJobStep stoppedBefore;

        private JobCanceledException(AiPlanJobStep stoppedBefore) {
            // 흐름 제어용이라 스택트레이스를 만들지 않는다.
            super(null, null, false, false);
            this.stoppedBefore = stoppedBefore;
        }
    }

    /**
     * 저장된 요청 파라미터를 LLM 질의로 옮기면서 <b>후보 장소를 여기서 붙인다.</b>
     *
     * <p>후보 조회를 어댑터가 아니라 이 계층이 하는 이유는, 어떤 데이터를 근거로 쓸지가
     * provider 세부사항이 아니라 <b>유스케이스의 결정</b>이기 때문이다. provider 를 바꿔도
     * "실제 DB 에 있는 동반 가능 장소 안에서만 고른다"는 규칙은 그대로 남아야 한다.
     *
     * <p><b>여기의 순서가 {@link AiPlanJobStep} 의 선언 순서다.</b> 전에는 빌더 체인 안에서
     * 조회가 일어나 순서가 코드 모양에 묻혀 있었는데, 화면에 단계를 알리려면 순서가 눈에
     * 보여야 한다 — 보이지 않으면 다음 사람이 줄을 옮기는 순간 진행률이 거짓이 된다.
     *
     * @param onStep 단계에 들어갈 때마다 부른다. 취소됐으면 여기서 흐름이 끊긴다
     */
    private AiPlanGenerationQuery toQuery(AiPlanJob job, Consumer<AiPlanJobStep> onStep) {
        Map<String, String> params = job.requestParams();
        Long memberId = job.memberId();

        onStep.accept(AiPlanJobStep.CONDITIONS);
        List<PetCondition> petConditions = loadPetConditions(params.get("petIds"), memberId);
        Integer regenerateDay = parseNullableInt(params.get("regenerateDay"));
        PlanOutline planOutline = loadPlanOutline(params.get("planId"), regenerateDay, memberId);

        onStep.accept(AiPlanJobStep.CANDIDATES);
        String areaCode = params.get("areaCode");
        String sigunguCode = emptyToNull(params.get("sigunguCode"));
        List<Long> pinnedPlaceIds = parseIdList(params.get("pinnedPlaceIds"));
        List<Long> favoritePlaceIds = loadFavoritePlaceIds(params.get("preferFavorites"), memberId);
        List<PlaceCandidate> placeCandidates =
            loadCandidates(areaCode, sigunguCode, pinnedPlaceIds, favoritePlaceIds);

        onStep.accept(AiPlanJobStep.WEATHER);
        List<DayWeatherOutlook> weatherOutlook =
            loadWeatherOutlook(areaCode, params.get("startDate"), params.get("endDate"));

        return AiPlanGenerationQuery.builder()
            .areaCode(areaCode)
            .startDate(params.get("startDate"))
            .endDate(params.get("endDate"))
            .budget(params.get("budget"))
            .requestNote(params.get("requestNote"))
            .petConditions(petConditions)
            .pinnedPlaceIds(pinnedPlaceIds)
            .favoritePlaceIds(favoritePlaceIds)
            .weatherOutlook(weatherOutlook)
            .regenerateDay(regenerateDay)
            .planOutline(planOutline)
            .placeCandidates(placeCandidates)
            .build();
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
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
     * 여행 기간에 걸치는 일자별 날씨 전망. 조회 실패·커버리지 밖은 빈 목록으로 관용 처리되어
     * 프롬프트에서 날씨 절이 빠진다 — 없는 날씨를 지어 적지 않는다.
     */
    private List<DayWeatherOutlook> loadWeatherOutlook(String areaCode, String startDateParam, String endDateParam) {
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
     * 후보 장소를 가져온다. 후보 없이 생성하면 모델이 존재하지 않는 장소를 지어내므로
     * 항상 부른다 — 후보가 비면 어댑터가 {@code NO_PLACE_CANDIDATES} 로 실패시킨다.
     */
    private List<PlaceCandidate> loadCandidates(
        String areaCode, String sigunguCode, List<Long> pinnedPlaceIds, List<Long> favoritePlaceIds
    ) {
        List<PlaceCandidate> searched = placeCandidateQueryPort
            .findPetFriendlyCandidates(areaCode, sigunguCode, aiLlmProperties.placeCandidateSize()).stream()
            .map(this::toCandidate)
            .toList();
        if (sigunguCode != null && searched.isEmpty()) {
            // 지역 전체로 넓히지 않는다. 사용자가 "제주시만" 이라고 한 요청에 서귀포 장소를
            // 섞으면 조건을 무시한 일정이 되고, 그 사실이 응답에 드러나지도 않는다.
            log.warn("No candidates in the requested sigungu areaCode={} sigunguCode={}", areaCode, sigunguCode);
        }
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
