package deu.se.hackathon.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmergencyRoomStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private boolean available;

    private int currentPatients;

    private int totalCapacity;

    // 병원과 1:1 관계 설정
    @OneToOne
    @JoinColumn(name = "hospital_id")
    private Hospital hospital;
}
