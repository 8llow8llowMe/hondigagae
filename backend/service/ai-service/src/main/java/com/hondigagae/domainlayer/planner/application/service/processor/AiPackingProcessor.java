package com.hondigagae.domainlayer.planner.application.service.processor;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.PackingListInfo;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.PlanOutlineQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.WeatherOutlookQueryPort;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 반려견 여행 준비물 목록 생성.
 *
 * <p>일정 생성과 달리 <b>동기</b>다 — 출력이 짧아(모델 몫 8개 이하, 기본 · 날씨 품목은 서버가 넣는다) 잡·SSE 인프라를 얹는 비용이
 * 이득보다 크다. LLM 응답이 수십 초일 수 있다는 사실은 API 문서에 명시한다.
 *
 * <p>근거 셋의 강도가 다르다: 기존 일정 개요는 <b>필수</b>(무엇을 하러 가는지 모르면 준비물이
 * 성립하지 않는다), 반려견 특성·날씨 전망은 <b>관용</b>(빠지면 그만큼 일반적인 목록이 된다).
 *
 * <p><b>같은 (회원, 일정)의 생성이 진행 중이면 새로 부르지 않고 그 결과를 함께 받는다 (#1337).</b>
 * 버튼 더블클릭이 dev 에서 LLM 을 두 번 불렀다 — 두 번째 요청이 게이트에서 24초 기다린 뒤 같은 일을
 * 다시 했고, 그동안 AI 일정 생성 잡까지 줄을 섰다. 오류 코드로 거절하지 않고 합치는 이유는 둘이다:
 * 두 요청이 바라는 답이 같고(같은 일정의 제안이며 저장하지 않는다), 거절하면 늦게 온 쪽 화면이
 * 멀쩡히 진행 중인 생성을 두고 실패를 띄운다. 실패도 함께 받고, 끝나면 슬롯을 비워 다음 요청은 새로 부른다.
 *
 * <p><b>전제: ai-service 인스턴스가 하나다</b> — {@code LlmCallGate} 와 같은 전제다. 인스턴스를 늘리면
 * 인스턴스마다 한 번씩 부를 수 있고, 그때는 게이트와 함께 프로세스 밖(Redis)으로 옮긴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiPackingProcessor {

    private final PlanOutlineQueryPort planOutlineQueryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final WeatherOutlookQueryPort weatherOutlookQueryPort;
    private final AiLlmPort aiLlmPort;

    private final ConcurrentMap<InFlightKey, CompletableFuture<PackingListInfo>> inFlight = new ConcurrentHashMap<>();

    public PackingListInfo generatePackingList(long memberId, long planId) {
        InFlightKey key = new InFlightKey(memberId, planId);
        CompletableFuture<PackingListInfo> mine = new CompletableFuture<>();
        CompletableFuture<PackingListInfo> running = inFlight.putIfAbsent(key, mine);
        if (running != null) {
            log.info("Packing list joined in-flight generation memberId={} planId={}", memberId, planId);
            return awaitShared(running);
        }
        // 슬롯을 결과 확정보다 먼저 비운다. 거꾸로면 그 틈에 온 요청이 끝난 future 를 받아,
        // 실패 직후의 재시도가 새로 부르지 않고 같은 오류만 돌려받는다.
        PackingListInfo info;
        try {
            info = generate(memberId, planId);
        } catch (Throwable failure) {
            inFlight.remove(key, mine);
            mine.completeExceptionally(failure);
            throw failure;
        }
        inFlight.remove(key, mine);
        mine.complete(info);
        return info;
    }

    /**
     * 먼저 온 요청의 결과를 기다린다. 기한을 따로 두지 않는다 — 먼저 온 요청이 게이트 대기 · 모델
     * 타임아웃에 이미 묶여 있어 그보다 오래 걸리지 않는다. 실패는 먼저 온 요청과 같은 예외로 받는다.
     */
    private PackingListInfo awaitShared(CompletableFuture<PackingListInfo> running) {
        try {
            return running.join();
        } catch (CompletionException exception) {
            if (exception.getCause() instanceof RuntimeException cause) {
                throw cause;
            }
            if (exception.getCause() instanceof Error cause) {
                throw cause;
            }
            throw exception;
        }
    }

    private PackingListInfo generate(long memberId, long planId) {
        PlanOutline outline = planOutlineQueryPort.findOutline(memberId, planId)
            .orElseThrow(() -> new AiPlanException(AiPlanErrorCode.PLAN_OUTLINE_UNAVAILABLE));

        PackingChecklistQuery query = PackingChecklistQuery.builder()
            .startDate(outline.startDate())
            .endDate(outline.endDate())
            .petConditions(loadPetConditions(memberId, outline))
            .weatherOutlook(loadWeatherOutlook(outline))
            .planOutline(outline)
            .build();

        return PackingListInfo.from(aiLlmPort.generatePackingList(query));
    }

    /**
     * 동행 반려견 <b>전체</b>의 특성.
     *
     * <p>예전에는 대표 한 마리만 봤다. 두 마리 일정에서 두 번째 이후 아이의 체중·더위/추위
     * 민감·견종이 근거에서 통째로 빠졌고, 소형견과 대형견을 함께 데려가는데 한쪽 기준
     * 준비물만 나왔다. 준비물은 항목마다 "이 여행 데이터에 근거한 이유"를 붙이는 것이 핵심인
     * 기능이라, 근거의 절반이 빠지면 그 문장 자체가 신뢰를 잃는다.
     *
     * <p>벌크로 한 번에 가져온다 (coding-conventions §9-7) - 마리 수만큼 왕복하지 않는다.
     *
     * <p>실패는 빈 목록이다. 특성이 없으면 그만큼 일반적인 목록이 될 뿐이고, auth 장애가
     * 준비물 생성 불가로 번지면 안 된다.
     */
    private List<PetCondition> loadPetConditions(long memberId, PlanOutline outline) {
        List<Long> petIds = outline.conditionPetIds();
        if (petIds.isEmpty()) {
            return List.of();
        }

        List<PetCondition> conditions = petConditionQueryPort.findConditions(memberId, petIds);
        if (conditions.size() < petIds.size()) {
            // 일부만 온 경우도 남긴다. 소유가 아닌 아이는 응답에서 빠지므로 정상일 수 있지만,
            // 조용히 줄어들면 "왜 이 아이 물건이 없지"를 추적할 단서가 없다.
            log.warn("Packing list pet conditions incomplete requested={} loaded={} memberId={}",
                petIds.size(), conditions.size(), memberId);
        }
        return conditions;
    }

    /** 여행 기간에 걸치는 전망만 남긴다. 날짜 해석이 안 되면 전망 없이 진행한다. */
    private List<DayWeatherOutlook> loadWeatherOutlook(PlanOutline outline) {
        LocalDate startDate;
        LocalDate endDate;
        try {
            startDate = LocalDate.parse(outline.startDate());
            endDate = LocalDate.parse(outline.endDate());
        } catch (RuntimeException exception) {
            log.warn("Packing list outline carried unusable dates start={} end={}",
                outline.startDate(), outline.endDate());
            return List.of();
        }
        return weatherOutlookQueryPort.findDailyOutlook(outline.areaCode()).stream()
            .filter(outlook -> !outlook.date().isBefore(startDate) && !outlook.date().isAfter(endDate))
            .toList();
    }

    private record InFlightKey(long memberId, long planId) {

    }
}
