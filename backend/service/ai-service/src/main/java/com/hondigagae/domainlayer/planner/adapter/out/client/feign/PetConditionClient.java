package com.hondigagae.domainlayer.planner.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PetConditionClientResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * auth-service 반려견 특성 조회.
 *
 * <p>게이트웨이를 거치지 않는 내부 경로({@code /internal/v1})를 부른다. 반려견 프로필의
 * 원천은 auth-service 이고, ai-service 는 사본을 두지 않는다. auth 쪽이 memberId 로
 * 소유권을 다시 확인하므로 남의 petId 를 넣어도 특성이 나오지 않는다.
 */
@FeignClient(
    name = "${feign-client.target-services.auth-service:auth-service}",
    contextId = "petConditionClient"
)
public interface PetConditionClient {

    @GetMapping("/internal/v1/pets/{petId}/condition")
    Response<PetConditionClientResponse> getPetCondition(
        @PathVariable long petId, @RequestParam("memberId") long memberId);
}
