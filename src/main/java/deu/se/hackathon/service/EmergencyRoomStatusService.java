package deu.se.hackathon.service;

import deu.se.hackathon.domain.EmergencyRoomStatus;
import deu.se.hackathon.domain.Hospital;
import deu.se.hackathon.dto.EmergencyRoomStatusDto;
import deu.se.hackathon.repository.EmergencyRoomStatusRepository;
import deu.se.hackathon.repository.HospitalRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmergencyRoomStatusService {

    private final EmergencyRoomStatusRepository emergencyRoomStatusRepository;
    private final HospitalRepository hospitalRepository;

    @Transactional
    public void updateStatus(Long hospitalId, EmergencyRoomStatusDto dto) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new IllegalArgumentException("병원을 찾을 수 없습니다."));

        EmergencyRoomStatus status = hospital.getEmergencyRoomStatus();

        if (status == null) {
            status = EmergencyRoomStatus.builder()
                    .available(dto.isAvailable())
                    .currentPatients(dto.getCurrentPatients())
                    .totalCapacity(dto.getTotalCapacity())
                    .hospital(hospital)
                    .build();
        } else {
            status.setAvailable(dto.isAvailable());
            status.setCurrentPatients(dto.getCurrentPatients());
            status.setTotalCapacity(dto.getTotalCapacity());
        }

        emergencyRoomStatusRepository.save(status);
    }

    public EmergencyRoomStatusDto getStatus(Long hospitalId) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new IllegalArgumentException("병원을 찾을 수 없습니다."));

        EmergencyRoomStatus status = hospital.getEmergencyRoomStatus();
        if (status == null) {
            throw new IllegalStateException("응급실 정보가 없습니다.");
        }

        return EmergencyRoomStatusDto.builder()
                .available(status.isAvailable())
                .currentPatients(status.getCurrentPatients())
                .totalCapacity(status.getTotalCapacity())
                .build();
    }
}
