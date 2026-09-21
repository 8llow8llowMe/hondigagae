package com.hondigagae.domainlayer.walkcourseimport.adapter.out.file;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * CSV 인코딩 판별 (#383).
 *
 * <p>공공데이터포털 원본이 CP949 라 UTF-8 로만 읽으면 한글이 통째로 깨진 채 저장되고,
 * 깨진 값은 파싱을 통과해 화면까지 샌다. 읽기 단계에서 잡는 것이 유일한 방어선이다.
 */
class OlleCourseCsvAdapterTest {

    private static final String CSV = """
        코스별,코스명,거리,소요시간정보,시종점정보,데이터기준일자
        1코스,시흥-광치기,15.1km,4~5시간,시흥리정류장-광치기해변,2025-04-28
        3코스,온평-표선(A),20.9km,6~7시간,온평포구-제주민속촌주차장입구,2025-04-28
        """;

    @TempDir
    Path tempDir;

    @Test
    @DisplayName("포털 원본(CP949)도 UTF-8 파일도 같은 값으로 읽힌다")
    void readsBothEncodings() throws IOException {
        Path utf8 = write("utf8.csv", StandardCharsets.UTF_8);
        Path ms949 = write("ms949.csv", Charset.forName("MS949"));

        List<ImportedWalkCourse> fromUtf8 = load(utf8);
        List<ImportedWalkCourse> fromMs949 = load(ms949);

        assertThat(fromUtf8).hasSize(2);
        assertThat(fromMs949).usingRecursiveComparison().isEqualTo(fromUtf8);

        ImportedWalkCourse variantCourse = fromUtf8.get(1);
        assertThat(variantCourse.courseKey()).isEqualTo("3-A");
        assertThat(variantCourse.name()).isEqualTo("온평-표선(A)");
        assertThat(variantCourse.distanceKm()).isEqualByComparingTo(new BigDecimal("20.9"));
        assertThat(variantCourse.durationMaxMinutes()).isEqualTo(420);
        assertThat(variantCourse.startEndPoint()).isEqualTo("온평포구-제주민속촌주차장입구");
    }

    @Test
    @DisplayName("시종점 원문을 두 지점명으로 갈라 함께 싣는다 - 원문도 그대로 남는다 (#816)")
    void carriesStartAndEndPointNames() throws IOException {
        List<ImportedWalkCourse> courses = load(write("names.csv", StandardCharsets.UTF_8));

        ImportedWalkCourse first = courses.get(0);
        assertThat(first.startPointName()).isEqualTo("시흥리정류장");
        assertThat(first.endPointName()).isEqualTo("광치기해변");
        // 원문은 손대지 않는다 - 화면이 한 줄로 보여 주는 값이 따로 있다
        assertThat(first.startEndPoint()).isEqualTo("시흥리정류장-광치기해변");
        // 종점 좌표는 적재 프로세서가 채운다 - CSV 만 읽은 단계에서는 비어 있다
        assertThat(first.endLat()).isNull();
        assertThat(first.endLng()).isNull();
    }

    private Path write(String fileName, Charset charset) throws IOException {
        Path path = tempDir.resolve(fileName);
        Files.write(path, CSV.getBytes(charset));
        return path;
    }

    private List<ImportedWalkCourse> load(Path path) {
        return new OlleCourseCsvAdapter().loadCourses(path);
    }
}
