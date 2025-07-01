package deu.se.hackathon.service;

import deu.se.hackathon.domain.EmergencyCall;
import deu.se.hackathon.domain.Patient;
import deu.se.hackathon.domain.User;
import deu.se.hackathon.dto.EmergencyCallDto;
import deu.se.hackathon.repository.EmergencyCallRepository;
import deu.se.hackathon.repository.PatientRepository;
import deu.se.hackathon.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class EmergencyCallService {

    private final EmergencyCallRepository emergencyCallRepository;
    private final UserRepository userRepository;
    private final PatientRepository patientRepository;

    public EmergencyCall createEmergencyCall(EmergencyCallDto dto) {
        Optional<User> userOpt = userRepository.findById(dto.getCreatedByUserId());
        Optional<Patient> patientOpt = patientRepository.findById(dto.getPatientId());

        if (userOpt.isEmpty() || patientOpt.isEmpty()) {
            throw new IllegalArgumentException("User or Patient not found.");
        }

        EmergencyCall call = EmergencyCall.builder()
                .requestTime(LocalDateTime.now())
                .createdBy(userOpt.get())
                .patient(patientOpt.get())
                .build();

        return emergencyCallRepository.save(call);
    }

    public List<EmergencyCall> getAllEmergencyCalls() {
        return emergencyCallRepository.findAll();
    }

    public EmergencyCall getEmergencyCall(Long id) {
        return emergencyCallRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found"));
    }
}
