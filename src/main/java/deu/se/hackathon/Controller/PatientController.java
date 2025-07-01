package deu.se.hackathon.Controller;

import deu.se.hackathon.domain.Patient;
import deu.se.hackathon.dto.PatientDto;
import deu.se.hackathon.service.PatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;

    @PostMapping
    public Patient save(@RequestBody PatientDto dto) {
        return patientService.savePatient(dto);
    }

    @GetMapping
    public List<Patient> getAll() {
        return patientService.getAllPatients();
    }
}
