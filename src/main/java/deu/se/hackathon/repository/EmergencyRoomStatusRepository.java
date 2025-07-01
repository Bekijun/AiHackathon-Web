package deu.se.hackathon.repository;

import deu.se.hackathon.domain.EmergencyRoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmergencyRoomStatusRepository extends JpaRepository<EmergencyRoomStatus, Long> {
    Optional<EmergencyRoomStatus> findByHospitalId(Long hospitalId);

}
