package com.hondigagae.domainlayer.planner.application.service;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.RequestNoteConstraints;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 명시 요청(실내 · 카페)을 후보 풀과 결과 요약에 반영한다 (#1170).
 *
 * <p>요청 문구는 프롬프트 한 줄로만 들어가고, 후보는 지역 상위 N 이라 카페 · 실내가
 * 빠질 수 있었다. 그러면 모델이 "휴식 장소를 배치함" 이라고 적어도 일정에는 야외만 남는다.
 * 맞는 장소를 풀의 앞에 두고, 풀에 없으면 요약이 그렇다고 말한다.
 */
public final class RequestNoteCandidatePolicy {

    /**
     * 근거 개수 상한. 프롬프트 규칙 4 · {@code OllamaLlmAdapter} 의 상한과 같다.
     * 없는 요청을 말하는 근거가 잘려 나가지 않게, 그 문장을 앞에 두고 여기서 다시 자른다.
     */
    static final int MAX_REASONS = 3;

    /** 화면 이름. 코드만 내보내면 {@code REQUEST_UNMET} 이 그대로 보인다. */
    static final String UNMET_CODE = "REQUEST_UNMET";
    static final String UNMET_NAME = "요청 반영";

    private RequestNoteCandidatePolicy() {
    }

    /**
     * 요청에 맞는 장소를 풀 앞에 두고 상한까지 채운다. 이미 있는 장소는 한 번만 남긴다.
     * 상한을 넘으면 일반 검색의 꼬리가 빠진다 — 프롬프트 길이는 그대로다.
     */
    public static List<PlaceCandidate> reserve(List<PlaceCandidate> matches, List<PlaceCandidate> base, int limit) {
        if (matches == null || matches.isEmpty() || limit <= 0) {
            return base == null ? List.of() : base;
        }
        Map<Long, PlaceCandidate> ordered = new LinkedHashMap<>();
        for (PlaceCandidate match : matches) {
            if (ordered.size() >= limit) {
                break;
            }
            ordered.putIfAbsent(match.placeId(), match);
        }
        if (base != null) {
            for (PlaceCandidate candidate : base) {
                if (ordered.size() >= limit) {
                    break;
                }
                ordered.putIfAbsent(candidate.placeId(), candidate);
            }
        }
        return List.copyOf(ordered.values());
    }

    /**
     * 후보에 요청한 장소가 없으면 요약 앞에 그 사실을 붙인다.
     * 넣었다고 말하는 근거(카페 · 실내 · 휴식 장소)는 뺀다.
     */
    public static AiPlanDraft disclose(AiPlanDraft draft, AiPlanGenerationQuery query) {
        RequestNoteConstraints constraints = RequestNoteConstraints.from(query.requestNote());
        if (!constraints.asksAnything()) {
            return draft;
        }
        boolean satisfied = query.safeCandidates().stream().anyMatch(constraints::matches);
        if (satisfied) {
            return draft;
        }
        String description = unmetDescription(constraints);
        List<AiPlanDraftReason> kept = new ArrayList<>();
        kept.add(AiPlanDraftReason.builder().code(UNMET_CODE).name(UNMET_NAME).description(description).build());
        for (AiPlanDraftReason reason : draft.reasons() == null ? List.<AiPlanDraftReason>of() : draft.reasons()) {
            if (claimsSatisfied(reason.description(), constraints)) {
                continue;
            }
            kept.add(reason);
            if (kept.size() >= MAX_REASONS) {
                break;
            }
        }
        return AiPlanDraft.builder().days(draft.days()).reasons(List.copyOf(kept)).build();
    }

    private static String unmetDescription(RequestNoteConstraints constraints) {
        if (constraints.cafe() && constraints.indoor()) {
            return "요청하신 실내 카페가 이번 후보에 없어요.";
        }
        if (constraints.cafe()) {
            return "요청하신 카페가 이번 후보에 없어요.";
        }
        return "요청하신 실내 장소가 이번 후보에 없어요.";
    }

    private static boolean claimsSatisfied(String description, RequestNoteConstraints constraints) {
        if (description == null) {
            return false;
        }
        if (description.contains("휴식 장소")) {
            return true;
        }
        if (constraints.cafe() && description.contains("카페")) {
            return true;
        }
        return constraints.indoor() && description.contains("실내");
    }
}
