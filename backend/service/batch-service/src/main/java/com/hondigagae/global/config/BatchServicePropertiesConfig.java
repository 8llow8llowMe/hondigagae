package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptPropertiesConfig;
import com.hondigagae.global.properties.BatchScheduleProperties;
import com.hondigagae.global.properties.CultureFacilityProperties;
import com.hondigagae.global.properties.MfdsPetRestaurantProperties;
import com.hondigagae.global.properties.OlleCourseProperties;
import com.hondigagae.global.properties.PlaceIntroImportProperties;
import com.hondigagae.global.properties.TourApiProperties;
import com.hondigagae.global.properties.VworldProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptPropertiesConfig.class
})
@EnableConfigurationProperties({
    TourApiProperties.class,
    PlaceIntroImportProperties.class,
    CultureFacilityProperties.class,
    MfdsPetRestaurantProperties.class,
    OlleCourseProperties.class,
    VworldProperties.class,
    BatchScheduleProperties.class
})
public class BatchServicePropertiesConfig {

}
