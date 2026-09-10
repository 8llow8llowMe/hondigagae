package com.hondigagae.domainlayer.walkcourseimport.adapter.out.file;

import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportErrorCode;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCatalogPort;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseParser;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 올레코스현황 CSV 어댑터 (data.go.kr/data/15043496).
 *
 * <p><b>인코딩을 판별해 읽는다.</b> 포털 원본이 CP949(MS949)라 UTF-8 로만 읽으면 한글이 통째로
 * 깨진 채 저장된다 - 깨진 값은 파싱 단계에서 잡히지 않고 화면까지 새므로, 읽기 단계에서
 * UTF-8 엄격 디코딩을 시도하고 실패하면 MS949 로 되읽는다.
 *
 * <p>컬럼: 코스별 / 코스명 / 거리 / 소요시간정보 / 시종점정보 / 데이터기준일자 (2025-04-28 기준 29행).
 * 값에 콤마·따옴표가 없는 단순 CSV 라 콤마 분리로 충분하다 - 컬럼 수가 어긋나는 행이 나오면
 * 원천 규격이 바뀐 것이라 조용히 건너뛰지 않고 실패시킨다.
 */
@Slf4j
@Component
public class OlleCourseCsvAdapter implements OlleCourseCatalogPort {

    private static final String[] REQUIRED_COLUMNS = {"코스별", "코스명", "거리", "소요시간정보", "시종점정보", "데이터기준일자"};

    @Override
    public List<ImportedWalkCourse> loadCourses(Path path) {
        if (!Files.exists(path)) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_NOT_FOUND, path.toAbsolutePath());
        }

        List<String> lines = readLines(path);
        if (lines.isEmpty()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_COLUMN_MISSING, "빈 파일");
        }

        List<String> header = Arrays.stream(lines.get(0).replace("\uFEFF", "").split(",", -1))
            .map(String::trim)
            .toList();
        int[] indices = new int[REQUIRED_COLUMNS.length];
        for (int i = 0; i < REQUIRED_COLUMNS.length; i++) {
            indices[i] = header.indexOf(REQUIRED_COLUMNS[i]);
            if (indices[i] < 0) {
                throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_COLUMN_MISSING, REQUIRED_COLUMNS[i]);
            }
        }

        List<ImportedWalkCourse> courses = new ArrayList<>();
        for (int lineNo = 1; lineNo < lines.size(); lineNo++) {
            String line = lines.get(lineNo);
            if (line.isBlank()) {
                continue;
            }
            String[] cells = line.split(",", -1);
            if (cells.length < header.size()) {
                throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_ROW_INVALID,
                    "line %d: 컬럼 %d/%d".formatted(lineNo + 1, cells.length, header.size()));
            }
            courses.add(toCourse(cells, indices));
        }
        log.info("olle course csv loaded. path={}, rows={}", path, courses.size());
        return courses;
    }

    private ImportedWalkCourse toCourse(String[] cells, int[] indices) {
        String courseNo = OlleCourseParser.courseNo(cells[indices[0]].trim());
        String name = cells[indices[1]].trim();
        String variant = OlleCourseParser.variantOf(name);
        String courseKey = OlleCourseParser.courseKey(courseNo, variant);
        String durationText = cells[indices[3]].trim();

        return ImportedWalkCourse.builder()
            .id(OlleCourseParser.walkCourseId(courseKey))
            .courseKey(courseKey)
            .courseNo(courseNo)
            .variant(variant)
            .courseOrder(OlleCourseParser.courseOrder(courseNo))
            .name(name)
            .distanceKm(OlleCourseParser.distanceKm(cells[indices[2]].trim()))
            .durationText(durationText)
            .durationMaxMinutes(OlleCourseParser.durationMaxMinutes(durationText))
            .startEndPoint(cells[indices[4]].trim())
            .baseDate(cells[indices[5]].trim())
            .build();
    }

    /**
     * UTF-8 엄격 디코딩을 먼저 시도하고, 깨지면 MS949 로 되읽는다. 순서가 반대면 안 된다 -
     * MS949 는 웬만한 바이트열을 오류 없이 "다른 한글"로 읽어 버려 판별 신호가 없다.
     */
    private List<String> readLines(Path path) {
        try {
            byte[] bytes = Files.readAllBytes(path);
            return List.of(decode(bytes, StandardCharsets.UTF_8).split("\\R"));
        } catch (java.nio.charset.CharacterCodingException exception) {
            return readLinesAsMs949(path);
        } catch (IOException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_READ_FAILED, exception, path);
        }
    }

    private List<String> readLinesAsMs949(Path path) {
        try {
            byte[] bytes = Files.readAllBytes(path);
            log.info("olle course csv is not UTF-8. falling back to MS949. path={}", path);
            return List.of(decode(bytes, Charset.forName("MS949")).split("\\R"));
        } catch (IOException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_READ_FAILED, exception, path);
        }
    }

    private String decode(byte[] bytes, Charset charset) throws java.nio.charset.CharacterCodingException {
        CharsetDecoder decoder = charset.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT);
        return decoder.decode(java.nio.ByteBuffer.wrap(bytes)).toString();
    }
}
