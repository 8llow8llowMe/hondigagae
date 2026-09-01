package com.hondigagae.domainlayer.placeimport.adapter.out.file;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PetRestaurantCatalogPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPetRestaurant;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceIdFactory;
import com.hondigagae.global.properties.MfdsPetRestaurantProperties;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * 식약처 반려동물 동반출입 음식점 현황(xlsx) 리더.
 *
 * <p>인증키가 필요 없다. 식품안전나라 화면의 엑셀 내려받기 경로에 POST 하면 파일이 바로 온다.
 * 다만 <b>공개된 오픈 API 가 아니라 화면이 쓰는 경로</b>라 규격이 바뀌면 끊긴다. 그래서
 * {@code mfds.pet-restaurant.file-path} 에 파일이 있으면 내려받기를 건너뛰고 그 파일을 읽는다.
 *
 * <p>시트 컬럼은 연번·업소명·업종·지역·업소주소 다섯이다. 좌표·전화·영업시간은 없다 —
 * 좌표는 {@code GeocodingPort} 가 뒤에서 채운다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MfdsPetRestaurantXlsxAdapter implements PetRestaurantCatalogPort {

    private static final String COL_NAME = "업소명";
    private static final String COL_BUSINESS_TYPE = "업종";
    private static final String COL_REGION = "지역";
    private static final String COL_ADDRESS = "업소주소";
    private static final List<String> REQUIRED_COLUMNS =
        List.of(COL_NAME, COL_BUSINESS_TYPE, COL_REGION, COL_ADDRESS);

    /** 원천의 지역 표기("제주")를 관광 API areaCode 로 옮기기 위한 시도 명칭. */
    private static final Map<String, String> REGION_TO_SIDO = Map.of("제주", "제주특별자치도");

    /** 서킷 인스턴스명. 식약처 파일 서버 전용이다. */
    public static final String CIRCUIT_NAME = "mfds";

    private final WebClient openApiWebClient;
    private final MfdsPetRestaurantProperties properties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public List<ImportedPetRestaurant> readPetRestaurants(String region) {
        byte[] workbookBytes = loadWorkbookBytes();

        List<ImportedPetRestaurant> restaurants = new ArrayList<>();
        int skippedOtherRegion = 0;

        try (InputStream input = new ByteArrayInputStream(workbookBytes);
             Workbook workbook = new XSSFWorkbook(input)) {

            Sheet sheet = workbook.getSheetAt(0);
            Map<String, Integer> header = readHeader(sheet);
            DataFormatter formatter = new DataFormatter();

            for (int rowIndex = sheet.getFirstRowNum() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null) {
                    continue;
                }
                String rowRegion = value(row, header, COL_REGION, formatter);
                if (region != null && !region.equals(rowRegion)) {
                    skippedOtherRegion++;
                    continue;
                }
                String name = value(row, header, COL_NAME, formatter);
                String address = value(row, header, COL_ADDRESS, formatter);
                if (name == null || address == null) {
                    continue;
                }
                restaurants.add(
                    toRestaurant(name, address, rowRegion, value(row, header, COL_BUSINESS_TYPE, formatter)));
            }
        } catch (IOException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.MFDS_FILE_READ_FAILED, exception, "xlsx 파싱");
        }

        log.info("mfds pet restaurant read region={} rows={} skippedOtherRegion={}",
            region, restaurants.size(), skippedOtherRegion);
        return restaurants;
    }

    private ImportedPetRestaurant toRestaurant(String name, String address, String region, String businessType) {
        return ImportedPetRestaurant.builder()
            .sourceKey(PlaceIdFactory.sourceKeyOf(name, address))
            .name(name)
            .businessType(businessType)
            .address(address)
            .areaCode(RegionCodeMapping.toAreaCode(REGION_TO_SIDO.get(region)))
            // 원천이 시군구를 따로 주지 않아 주소 문자열에서 읽는다.
            .sigunguCode(RegionCodeMapping.toSigunguCodeFromAddress(address))
            .build();
    }

    /**
     * 파일을 읽거나 내려받는다.
     *
     * <p>내려받기가 기본이다 — 등록 업소가 빠르게 느는 중이라 최신본이 중요하다.
     * 설정한 경로에 파일이 있으면 그쪽을 우선한다(원천 경로가 막혔을 때의 우회로).
     */
    private byte[] loadWorkbookBytes() {
        String filePath = properties.filePath();
        if (filePath != null && !filePath.isBlank()) {
            Path path = Path.of(filePath);
            if (Files.exists(path)) {
                try {
                    log.info("mfds pet restaurant read from file path={}", path);
                    return Files.readAllBytes(path);
                } catch (IOException exception) {
                    throw new PlaceImportException(
                        PlaceImportErrorCode.MFDS_FILE_READ_FAILED, exception, path.toString());
                }
            }
        }
        return download();
    }

    /**
     * 원천에서 xlsx 를 내려받는다.
     *
     * <p>여기는 잡당 한 번만 부르는 경로라 서킷이 호출 수를 줄여 주지는 않는다. 그래도 거는
     * 이유는 <b>실패를 빨리 드러내기 위해서다</b> - 원천이 죽어 있을 때 재시도로 시간을 끌기보다
     * 잡을 즉시 실패시키는 편이 낫다. 파일이 없으면 어차피 적재할 것이 없다.
     */
    private byte[] download() {
        String uri = properties.baseUrl() + properties.downloadPath();
        try {
            byte[] body = circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(() ->
                openApiWebClient.post()
                    .uri(uri)
                    // 화면이 쓰는 경로라 Referer 를 붙여 둔다.
                    .header("Referer", properties.baseUrl() + "/portal/petKorea.do")
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .block(Duration.ofMillis(properties.readTimeoutMs()))
            );

            if (body == null || body.length == 0) {
                throw new PlaceImportException(PlaceImportErrorCode.MFDS_DOWNLOAD_FAILED, "빈 응답");
            }
            log.info("mfds pet restaurant downloaded bytes={}", body.length);
            return body;
        } catch (CallNotPermittedException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.MFDS_CIRCUIT_OPEN, exception);
        } catch (PlaceImportException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.MFDS_DOWNLOAD_FAILED, exception, uri);
        }
    }

    private Map<String, Integer> readHeader(Sheet sheet) {
        Row headerRow = sheet.getRow(sheet.getFirstRowNum());
        if (headerRow == null) {
            throw new PlaceImportException(PlaceImportErrorCode.MFDS_FILE_READ_FAILED, "빈 시트");
        }

        DataFormatter formatter = new DataFormatter();
        Map<String, Integer> header = new HashMap<>();
        for (int i = headerRow.getFirstCellNum(); i < headerRow.getLastCellNum(); i++) {
            Cell cell = headerRow.getCell(i);
            if (cell != null) {
                header.put(formatter.formatCellValue(cell).trim(), i);
            }
        }

        List<String> missing = REQUIRED_COLUMNS.stream().filter(column -> !header.containsKey(column)).toList();
        if (!missing.isEmpty()) {
            throw new PlaceImportException(PlaceImportErrorCode.MFDS_COLUMN_MISSING, String.join(", ", missing));
        }
        return header;
    }

    private String value(Row row, Map<String, Integer> header, String column, DataFormatter formatter) {
        Integer index = header.get(column);
        if (index == null) {
            return null;
        }
        Cell cell = row.getCell(index);
        if (cell == null) {
            return null;
        }
        String raw = formatter.formatCellValue(cell).trim();
        return raw.isEmpty() ? null : raw;
    }
}
