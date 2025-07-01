package deu.se.hackathon.repository;

import deu.se.hackathon.domain.EmergencyCall;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmergencyCallRepository extends JpaRepository<EmergencyCall, Long> {
}
