package com.hondigagae.storage.config;

import com.hondigagae.storage.properties.StorageProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StoragePropertiesConfig {

}
