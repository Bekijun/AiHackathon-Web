package deu.se.hackathon.service;

import deu.se.hackathon.domain.Patient;
import deu.se.hackathon.dto.PatientDto;
import deu.se.hackathon.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientRepository patientRepository;

    public Patient savePatient(PatientDto dto) {
        Patient patient = Patient.builder()
                .name(dto.getName())
                .age(dto.getAge())
                .gender(dto.getGender())
                .symptoms(dto.getSymptoms())
                .build();
        return patientRepository.save(patient);
    }

    public List<Patient> getAllPatients() {
        return patientRepository.findAll();
    }
}
