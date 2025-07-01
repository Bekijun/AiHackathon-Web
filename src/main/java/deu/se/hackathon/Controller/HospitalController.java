package deu.se.hackathon.Controller;

import deu.se.hackathon.domain.Hospital;
import deu.se.hackathon.dto.HospitalDto;
import deu.se.hackathon.service.HospitalService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/hospitals")
public class HospitalController {

    private final HospitalService hospitalService;

    @PostMapping
    public Hospital save(@RequestBody HospitalDto hospitalDto) {
        return hospitalService.saveHospital(hospitalDto);
    }

    @GetMapping
    public List<Hospital> findAll() {
        return hospitalService.getAllHospitals();
    }
}
