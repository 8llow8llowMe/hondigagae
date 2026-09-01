package com.hondigagae.domainlayer.pet.adapter.in.internal.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.pet.adapter.in.internal.dto.PetConditionResponse;
import com.hondigagae.domainlayer.pet.application.port.in.PetInternalUseCase;
import io.swagger.v3.oas.annotations.Hidden;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import java.util.List;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서비스 간 호출 전용 엔드포인트.
 *
 * <p><b>경로가 {@code /internal/v1} 인 것이 보호 장치다.</b> 게이트웨이는 {@code /api/v1/**}
 * 만 외부로 라우팅하므로 이 경로는 클러스터 밖에서 닿지 않는다. Eureka 를 통한 내부 호출만
 * 도달한다.
 *
 * <p>그럼에도 {@code memberId} 를 받아 소유권을 다시 확인한다. 경로 격리는 네트워크 수준의
 * 방어이고, 호출한 서비스의 버그까지 막아 주지는 않는다.
 *
 * <p>{@code @Hidden} 으로 공개 Swagger 문서에서 감춘다 (coding-conventions §6).
 */
@Hidden
@RestController
@RequiredArgsConstructor
@RequestMapping("/internal/v1/pets")
public class PetInternalController {

    private final PetInternalUseCase petInternalUseCase;

    @GetMapping("/{petId}/condition")
    public ResponseEntity<Response<PetConditionResponse>> getPetCondition(
        @PathVariable long petId,
        @RequestParam long memberId
    ) {
        return ResponseEntity.ok().body(Response.success(petInternalUseCase.getPetCondition(memberId, petId)));
    }

    /**
     * 여러 마리 특성 벌크 조회 — ai-service 가 마리 수만큼 왕복하지 않게 한다 (§9-7).
     * 본인 소유가 아니거나 없는 petId 는 응답에서 빠진다.
     */
    @GetMapping("/conditions")
    public ResponseEntity<Response<List<PetConditionResponse>>> getPetConditions(
        @RequestParam long memberId,
        @RequestParam List<Long> petIds
    ) {
        return ResponseEntity.ok().body(Response.success(petInternalUseCase.getPetConditions(memberId, petIds)));
    }

    /** 대표 반려견 특성 - 호출부가 petId 없이 요청했을 때의 기본값. 없으면 404. */
    @GetMapping("/representative/condition")
    public ResponseEntity<Response<PetConditionResponse>> getRepresentativePetCondition(
        @RequestParam long memberId
    ) {
        return ResponseEntity.ok().body(Response.success(petInternalUseCase.getRepresentativePetCondition(memberId)));
    }
}
