package com.hondigagae.domainlayer.walkcourseimport.application.service;

import com.hondigagae.domainlayer.walkcourseimport.application.port.in.WalkCourseImportUseCase;
import com.hondigagae.domainlayer.walkcourseimport.application.service.processor.OlleCourseImportProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WalkCourseImportFacade implements WalkCourseImportUseCase {

    private final OlleCourseImportProcessor olleCourseImportProcessor;

    @Override
    public int importOlleCourses() {
        return olleCourseImportProcessor.importCourses();
    }
}
