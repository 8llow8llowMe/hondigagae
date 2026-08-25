package com.hondigagae;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@EnableDiscoveryClient
@SpringBootApplication(scanBasePackages = {
    "com.hondigagae.domainlayer",
    "com.hondigagae.global"
})
public class TourServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(TourServiceApplication.class, args);
    }

}
