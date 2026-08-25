package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceImportProcessor;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 장소 적재 유스케이스 오케스트레이터.
 *
 * <p>{@code @Transactional}을 붙이지 않는다 — 적재는 외부 API 호출(수십 페이지의 HTTP I/O)을
 * 반복하는 작업이라 하나의 트랜잭션으로 묶으면 DB 커넥션을 잡은 채 대기하게 된다.
 * 쓰기 원자성은 페이지 단위 upsert(JdbcTemplate batchUpdate)로 충분하고, 재실행이 멱등이라
 * 중간 실패 시 잡을 다시 돌리면 된다.
 */
@Service
@RequiredArgsConstructor
public class PlaceImportFacade implements PlaceImportUseCase {

    private final PlaceImportProcessor placeImportProcessor;

    @Override
    public int importPlaces(String areaCode, List<PlaceContentType> contentTypes) {
        return placeImportProcessor.importPlaces(areaCode, contentTypes);
    }
}
