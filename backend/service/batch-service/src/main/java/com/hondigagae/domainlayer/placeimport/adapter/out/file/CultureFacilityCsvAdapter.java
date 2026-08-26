package com.hondigagae.domainlayer.placeimport.adapter.out.file;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilityCatalogPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.CultureCategoryMapping;
import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
import com.hondigagae.domainlayer.placeimport.domain.model.PetFieldParser;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceIdFactory;
import com.hondigagae.global.properties.CultureFacilityProperties;
import java.io.BufferedReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 한국문화정보원 CSV 리더.
 *
 * <p>파일은 공공데이터포털에서 활용신청 없이 받는다(전국 약 70,650행, 30MB).
 * 전국을 메모리에 올리지 않도록 한 줄씩 읽으면서 시도·카테고리 필터를 먼저 적용한다.
 *
 * <p><b>인코딩</b>: UTF-8 BOM 이다. BOM 을 걷어내지 않으면 첫 컬럼명이 깨져 헤더 매칭이 통째로 실패한다.
 *
 * <p><b>CSV 파싱</b>: 값 안에 콤마가 들어간 따옴표 필드가 있어 단순 split 으로는 컬럼이 밀린다.
 * 외부 라이브러리를 더하지 않고 따옴표 상태만 추적하는 최소 파서를 둔다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CultureFacilityCsvAdapter implements CultureFacilityCatalogPort {

    private static final char DELIMITER = ',';
    private static final char QUOTE = '"';
    private static final String BOM = "﻿";

    // 실제 파일 헤더 그대로다. 띄어쓰기가 컬럼마다 들쭉날쭉해 상수로 고정한다.
    private static final String COL_NAME = "시설명";
    private static final String COL_CATEGORY3 = "카테고리3";
    private static final String COL_SIDO = "시도 명칭";
    private static final String COL_SIGUNGU = "시군구 명칭";
    private static final String COL_LAT = "위도";
    private static final String COL_LNG = "경도";
    private static final String COL_ZIPCODE = "우편번호";
    private static final String COL_ROAD_ADDR = "도로명주소";
    private static final String COL_LOT_ADDR = "지번주소";
    private static final String COL_TEL = "전화번호";
    private static final String COL_HOMEPAGE = "홈페이지";
    private static final String COL_REST_DATE = "휴무일";
    private static final String COL_USE_TIME = "운영시간";
    private static final String COL_PET_AVAILABLE = "반려동물 동반 가능정보";
    private static final String COL_PET_ONLY = "반려동물 전용 정보";
    private static final String COL_PET_SIZE = "입장 가능 동물 크기";
    private static final String COL_PET_RESTRICTION = "반려동물 제한사항";
    private static final String COL_INDOOR = "장소(실내) 여부";
    private static final String COL_OUTDOOR = "장소(실외)여부";
    private static final String COL_DESCRIPTION = "기본 정보_장소설명";
    private static final String COL_PET_FEE = "애견 동반 추가 요금";
    private static final String COL_PARKING = "주차 가능여부";
    private static final String COL_ADMISSION_FEE = "입장(이용료)가격 정보";
    private static final String COL_MODIFIED = "최종작성일";

    private static final List<String> REQUIRED_COLUMNS = List.of(
        COL_NAME, COL_CATEGORY3, COL_SIDO, COL_LAT, COL_LNG, COL_PET_AVAILABLE);

    private final CultureFacilityProperties properties;

    @Override
    public List<ImportedCultureFacility> readTravelFacilities(String sido) {
        Path path = Path.of(properties.filePath());
        if (!Files.exists(path)) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_CSV_NOT_FOUND, path.toString());
        }

        List<ImportedCultureFacility> facilities = new ArrayList<>();
        int skippedNonTravel = 0;
        int skippedNoCoordinate = 0;

        try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            Map<String, Integer> header = readHeader(reader);

            String line;
            while ((line = readRecord(reader)) != null) {
                List<String> values = parseLine(line);
                String rowSido = value(values, header, COL_SIDO);
                if (sido != null && !sido.equals(rowSido)) {
                    continue;
                }
                String category3 = value(values, header, COL_CATEGORY3);
                if (!CultureCategoryMapping.isTravelCategory(category3)) {
                    skippedNonTravel++;
                    continue;
                }
                ImportedCultureFacility facility = toFacility(values, header, category3);
                if (facility.lat() == null || facility.lng() == null) {
                    skippedNoCoordinate++;
                    continue;
                }
                facilities.add(facility);
            }
        } catch (IOException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_CSV_READ_FAILED, exception, path.toString());
        }

        log.info("culture facility csv read sido={} imported={} skippedNonTravel={} skippedNoCoordinate={}",
            sido, facilities.size(), skippedNonTravel, skippedNoCoordinate);
        return facilities;
    }

    private Map<String, Integer> readHeader(BufferedReader reader) throws IOException {
        String headerLine = readRecord(reader);
        if (headerLine == null) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_CSV_READ_FAILED, "빈 파일");
        }
        if (headerLine.startsWith(BOM)) {
            headerLine = headerLine.substring(1);
        }

        List<String> columns = parseLine(headerLine);
        Map<String, Integer> header = new HashMap<>();
        for (int i = 0; i < columns.size(); i++) {
            header.put(columns.get(i).trim(), i);
        }

        List<String> missing = REQUIRED_COLUMNS.stream().filter(column -> !header.containsKey(column)).toList();
        if (!missing.isEmpty()) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_CSV_COLUMN_MISSING, String.join(", ", missing));
        }
        return header;
    }

    /**
     * 논리적인 CSV 레코드 하나를 읽는다. 따옴표 안에 줄바꿈이 든 값이 있어 한 줄 = 한 레코드가 아니다.
     */
    private String readRecord(BufferedReader reader) throws IOException {
        String line = reader.readLine();
        if (line == null) {
            return null;
        }
        StringBuilder record = new StringBuilder(line);
        while (hasUnclosedQuote(record.toString())) {
            String next = reader.readLine();
            if (next == null) {
                break;
            }
            record.append('\n').append(next);
        }
        return record.toString();
    }

    private boolean hasUnclosedQuote(String value) {
        int count = 0;
        for (int i = 0; i < value.length(); i++) {
            if (value.charAt(i) == QUOTE) {
                count++;
            }
        }
        return count % 2 != 0;
    }

    private List<String> parseLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuote = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == QUOTE) {
                boolean escapedQuote = inQuote && i + 1 < line.length() && line.charAt(i + 1) == QUOTE;
                if (escapedQuote) {
                    current.append(QUOTE);
                    i++;
                    continue;
                }
                inQuote = !inQuote;
                continue;
            }
            if (c == DELIMITER && !inQuote) {
                values.add(current.toString());
                current.setLength(0);
                continue;
            }
            current.append(c);
        }
        values.add(current.toString());
        return values;
    }

    private ImportedCultureFacility toFacility(List<String> values, Map<String, Integer> header, String category3) {
        String name = value(values, header, COL_NAME);
        String roadAddress = value(values, header, COL_ROAD_ADDR);
        String lotAddress = value(values, header, COL_LOT_ADDR);
        String address = isBlank(roadAddress) ? lotAddress : roadAddress;

        boolean petAvailable = PetFieldParser.parseYn(value(values, header, COL_PET_AVAILABLE));
        String petSizeRaw = value(values, header, COL_PET_SIZE);
        String petOnlyRaw = value(values, header, COL_PET_ONLY);

        return ImportedCultureFacility.builder()
            .sourceKey(PlaceIdFactory.sourceKeyOf(name, address))
            .sourceCategory(category3)
            .contentTypeId(CultureCategoryMapping.toContentTypeId(category3))
            .title(name)
            .addr1(address)
            .zipcode(value(values, header, COL_ZIPCODE))
            .areaCode(RegionCodeMapping.toAreaCode(value(values, header, COL_SIDO)))
            .sigunguCode(RegionCodeMapping.toSigunguCode(value(values, header, COL_SIGUNGU)))
            .lat(toDecimal(value(values, header, COL_LAT)))
            .lng(toDecimal(value(values, header, COL_LNG)))
            .tel(value(values, header, COL_TEL))
            .homepage(value(values, header, COL_HOMEPAGE))
            .overview(value(values, header, COL_DESCRIPTION))
            .petAvailable(petAvailable)
            // 이 원천에는 "전구역/일부구역" 문구가 없어 제한사항 문구로 부분 동반 여부를 가늠한다.
            .petAllowanceType(PetFieldParser.parseAllowanceType(petAvailable, value(values, header, COL_PET_RESTRICTION)))
            .indoor(PetFieldParser.parseYn(value(values, header, COL_INDOOR)))
            .outdoor(PetFieldParser.parseYn(value(values, header, COL_OUTDOOR)))
            .petOnly(petOnlyRaw != null && petOnlyRaw.contains("전용"))
            .allowedPetSize(PetFieldParser.parseAllowedPetSize(petSizeRaw))
            .petRestriction(value(values, header, COL_PET_RESTRICTION))
            .petExtraFee(value(values, header, COL_PET_FEE))
            .useTime(value(values, header, COL_USE_TIME))
            .restDate(value(values, header, COL_REST_DATE))
            .parking(value(values, header, COL_PARKING))
            .admissionFee(value(values, header, COL_ADMISSION_FEE))
            .sourceModifiedAt(toDateTime(value(values, header, COL_MODIFIED)))
            .build();
    }

    private String value(List<String> values, Map<String, Integer> header, String column) {
        Integer index = header.get(column);
        if (index == null || index >= values.size()) {
            return null;
        }
        String raw = values.get(index).trim();
        return raw.isEmpty() ? null : raw;
    }

    private BigDecimal toDecimal(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    /** 최종작성일은 yyyy-MM-dd 형태다. 형식이 어긋난 행 때문에 적재 전체가 멈추지 않도록 null 로 흘린다. */
    private LocalDateTime toDateTime(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim()).atStartOfDay();
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
