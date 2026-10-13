package com.hondigagae.domainlayer.planner.application.service;

import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 명시 요청(실내 · 카페)을 후보 풀에 반영한다 (#1170).
 *
 * <p>요청 문구는 프롬프트 한 줄로만 들어가고, 후보는 지역 상위 N 이라 카페 · 실내가
 * 빠질 수 있었다. 그러면 모델이 "휴식 장소를 배치함" 이라고 적어도 일정에는 야외만 남는다.
 * 맞는 장소를 풀의 앞에 둔다. 초안에 날마다 들어갔는지 맞추고 근거로 말하는 일은
 * {@link RequestNoteDraftPolicy} 가 한다 (#1423).
 */
public final class RequestNoteCandidatePolicy {

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
}
